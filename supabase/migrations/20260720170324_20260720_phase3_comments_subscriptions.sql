/*
# StreamWorld Phase 3: Comments, Subscriptions, Shorts infrastructure

## Tables

1. `comments` — Video comments with nested replies
2. `subscriptions` — Creator subscription relationships
3. `comment_likes` — Likes on comments

## Security

All tables have RLS enabled with ownership-scoped policies:
- Users can CRUD their own comments, comment_likes, subscriptions
- Anyone can read published video comments
- Admins can delete any comment (moderation)
- Creators receive notifications on subscribe (via trigger)
*/

-- =============================================================
-- 1. Comments table
-- =============================================================

CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  body text NOT NULL,
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_all" ON comments FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "comments_insert_own" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_update_own" ON comments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comments_delete_own_or_admin" ON comments FOR DELETE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- =============================================================
-- 2. Comment likes table
-- =============================================================

CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON comment_likes(user_id);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comment_likes_select_all" ON comment_likes FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "comment_likes_insert_own" ON comment_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "comment_likes_delete_own" ON comment_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- =============================================================
-- 3. Subscriptions table
-- =============================================================

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscriber_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_channel ON subscriptions(channel_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subscriptions_select_all" ON subscriptions FOR SELECT
  TO anon, authenticated USING (true);

CREATE POLICY "subscriptions_insert_own" ON subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = subscriber_id AND auth.uid() <> channel_id);

CREATE POLICY "subscriptions_delete_own" ON subscriptions FOR DELETE
  TO authenticated USING (auth.uid() = subscriber_id);

-- =============================================================
-- 4. Notification trigger for subscriptions
-- =============================================================

CREATE OR REPLACE FUNCTION notify_on_subscribe()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, video_id, title, body, type)
  VALUES (
    NEW.channel_id,
    NULL,
    'New subscriber',
    'Someone subscribed to your channel',
    'subscription'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_subscribe_notify ON subscriptions;
CREATE TRIGGER on_subscribe_notify
  AFTER INSERT ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION notify_on_subscribe();

-- =============================================================
-- 5. Notification trigger for comments
-- =============================================================

CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER AS $$
DECLARE
  video_uploader uuid;
BEGIN
  SELECT uploader_id INTO video_uploader FROM videos WHERE id = NEW.video_id;
  IF video_uploader IS NOT NULL AND video_uploader <> NEW.user_id THEN
    INSERT INTO notifications (user_id, video_id, title, body, type)
    VALUES (
      video_uploader,
      NEW.video_id,
      'New comment',
      'Someone commented on your video',
      'comment'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_notify ON comments;
CREATE TRIGGER on_comment_notify
  AFTER INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION notify_on_comment();

-- =============================================================
-- 6. Notification trigger for likes
-- =============================================================

CREATE OR REPLACE FUNCTION notify_on_video_like()
RETURNS TRIGGER AS $$
DECLARE
  video_uploader uuid;
BEGIN
  SELECT uploader_id INTO video_uploader FROM videos WHERE id = NEW.video_id;
  IF video_uploader IS NOT NULL AND video_uploader <> NEW.user_id THEN
    INSERT INTO notifications (user_id, video_id, title, body, type)
    VALUES (
      video_uploader,
      NEW.video_id,
      'New like',
      'Someone liked your video',
      'like'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_video_like_notify ON video_likes;
CREATE TRIGGER on_video_like_notify
  AFTER INSERT ON video_likes
  FOR EACH ROW EXECUTE FUNCTION notify_on_video_like();

-- =============================================================
-- 7. Add type column to notifications if missing
-- =============================================================

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text DEFAULT 'video';
