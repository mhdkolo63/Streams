/*
# Phase 6 Supplementary: Align existing tables and add missing ones

## Overview
Some Phase 6 tables already exist from a prior partial run with slightly different schemas.
This migration adds missing columns, creates missing tables, and adds missing indexes/triggers/RLS.

## Changes

### live_streams additions:
- stream_url (text) — for actual stream playback
- is_member_only (boolean default false)
- chat_enabled (boolean default true)
- slow_mode (boolean default false)
- slow_mode_interval (integer default 5)
- subscriber_only_chat (boolean default false)
- Rename 'featured' to 'is_featured' via new column (keep featured for compat)

### live_chat_messages additions:
- parent_id (uuid self-ref) — for replies

### channel_memberships additions:
- is_active (boolean default true)
- Rename member_id to user_id via new column

### donations additions:
- type (text) — super_thanks / super_chat / tip
- Rename donor_id to sender_id via new column

### platform_settings additions:
- premium_videos_enabled (boolean) — alias for premium_content_enabled
- watch_party_enabled (boolean default false)

### New tables:
- video_schedules
- downloads
- watch_parties
- watch_party_participants

### New columns on videos:
- is_premium, is_member_only, premiere_at, scheduled_at, download_count

### New columns on profiles:
- is_premium, is_eligible_creator, monetization_approved

### Triggers:
- notify_subscribers_on_live
- notify_subscribers_on_premiere
- notify_on_scheduled_publish
- update_live_streams_updated_at (already exists)

### RPCs:
- publish_scheduled_videos
- get_live_streams
- get_creator_analytics_extended
*/

-- ============================================================
-- 1. ADD MISSING COLUMNS TO live_streams
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_streams' AND column_name = 'stream_url') THEN
    ALTER TABLE live_streams ADD COLUMN stream_url text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_streams' AND column_name = 'is_member_only') THEN
    ALTER TABLE live_streams ADD COLUMN is_member_only boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_streams' AND column_name = 'chat_enabled') THEN
    ALTER TABLE live_streams ADD COLUMN chat_enabled boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_streams' AND column_name = 'slow_mode') THEN
    ALTER TABLE live_streams ADD COLUMN slow_mode boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_streams' AND column_name = 'slow_mode_interval') THEN
    ALTER TABLE live_streams ADD COLUMN slow_mode_interval integer NOT NULL DEFAULT 5;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_streams' AND column_name = 'subscriber_only_chat') THEN
    ALTER TABLE live_streams ADD COLUMN subscriber_only_chat boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_streams' AND column_name = 'is_featured') THEN
    ALTER TABLE live_streams ADD COLUMN is_featured boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Copy featured to is_featured if needed
UPDATE live_streams SET is_featured = featured WHERE is_featured = false AND featured = true;

-- ============================================================
-- 2. ADD MISSING COLUMNS TO live_chat_messages
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'live_chat_messages' AND column_name = 'parent_id') THEN
    ALTER TABLE live_chat_messages ADD COLUMN parent_id uuid REFERENCES live_chat_messages(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. ADD MISSING COLUMNS TO channel_memberships
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_memberships' AND column_name = 'is_active') THEN
    ALTER TABLE channel_memberships ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'channel_memberships' AND column_name = 'user_id') THEN
    ALTER TABLE channel_memberships ADD COLUMN user_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Copy member_id to user_id
UPDATE channel_memberships SET user_id = member_id WHERE user_id IS NULL AND member_id IS NOT NULL;

-- ============================================================
-- 4. ADD MISSING COLUMNS TO donations
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'type') THEN
    ALTER TABLE donations ADD COLUMN type text NOT NULL DEFAULT 'tip' CHECK (type IN ('super_thanks', 'super_chat', 'tip'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'sender_id') THEN
    ALTER TABLE donations ADD COLUMN sender_id uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'donations' AND column_name = 'receiver_id') THEN
    ALTER TABLE donations ADD COLUMN receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Copy donor_id to sender_id, creator_id to receiver_id
UPDATE donations SET sender_id = donor_id WHERE sender_id IS NULL AND donor_id IS NOT NULL;
UPDATE donations SET receiver_id = creator_id WHERE receiver_id IS NULL AND creator_id IS NOT NULL;

-- ============================================================
-- 5. ADD MISSING COLUMNS TO platform_settings
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_settings' AND column_name = 'premium_videos_enabled') THEN
    ALTER TABLE platform_settings ADD COLUMN premium_videos_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'platform_settings' AND column_name = 'watch_party_enabled') THEN
    ALTER TABLE platform_settings ADD COLUMN watch_party_enabled boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 6. CREATE MISSING TABLES
-- ============================================================

-- video_schedules
CREATE TABLE IF NOT EXISTS video_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  premiere boolean NOT NULL DEFAULT false,
  scheduled_at timestamptz NOT NULL,
  countdown_started boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE video_schedules ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_video_schedules_scheduled ON video_schedules(scheduled_at) WHERE published = false;
CREATE INDEX IF NOT EXISTS idx_video_schedules_video ON video_schedules(video_id);

DROP POLICY IF EXISTS "public_read_video_schedules" ON video_schedules;
CREATE POLICY "public_read_video_schedules"
  ON video_schedules FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "creator_insert_video_schedules" ON video_schedules;
CREATE POLICY "creator_insert_video_schedules"
  ON video_schedules FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "creator_update_video_schedules" ON video_schedules;
CREATE POLICY "creator_update_video_schedules"
  ON video_schedules FOR UPDATE
  TO authenticated USING (
    auth.uid() = creator_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  ) WITH CHECK (
    auth.uid() = creator_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "creator_delete_video_schedules" ON video_schedules;
CREATE POLICY "creator_delete_video_schedules"
  ON video_schedules FOR DELETE
  TO authenticated USING (
    auth.uid() = creator_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- downloads
CREATE TABLE IF NOT EXISTS downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  quality text NOT NULL DEFAULT 'auto',
  file_size bigint DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'downloading', 'completed', 'failed', 'expired')),
  storage_path text,
  downloaded_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_downloads_user_video ON downloads(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_downloads_user ON downloads(user_id);

DROP POLICY IF EXISTS "owner_select_downloads" ON downloads;
CREATE POLICY "owner_select_downloads"
  ON downloads FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_insert_downloads" ON downloads;
CREATE POLICY "owner_insert_downloads"
  ON downloads FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_update_downloads" ON downloads;
CREATE POLICY "owner_update_downloads"
  ON downloads FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "owner_delete_downloads" ON downloads;
CREATE POLICY "owner_delete_downloads"
  ON downloads FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- watch_parties
CREATE TABLE IF NOT EXISTS watch_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'active', 'ended')),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz,
  ended_at timestamptz
);

ALTER TABLE watch_parties ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_watch_parties_host ON watch_parties(host_id);
CREATE INDEX IF NOT EXISTS idx_watch_parties_status ON watch_parties(status);

DROP POLICY IF EXISTS "public_read_watch_parties" ON watch_parties;
CREATE POLICY "public_read_watch_parties"
  ON watch_parties FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "host_insert_watch_parties" ON watch_parties;
CREATE POLICY "host_insert_watch_parties"
  ON watch_parties FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "host_update_watch_parties" ON watch_parties;
CREATE POLICY "host_update_watch_parties"
  ON watch_parties FOR UPDATE
  TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "host_delete_watch_parties" ON watch_parties;
CREATE POLICY "host_delete_watch_parties"
  ON watch_parties FOR DELETE
  TO authenticated USING (auth.uid() = host_id);

-- watch_party_participants
CREATE TABLE IF NOT EXISTS watch_party_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES watch_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now()
);

ALTER TABLE watch_party_participants ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_party_participants_pair ON watch_party_participants(party_id, user_id);

DROP POLICY IF EXISTS "public_read_party_participants" ON watch_party_participants;
CREATE POLICY "public_read_party_participants"
  ON watch_party_participants FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_party_participants" ON watch_party_participants;
CREATE POLICY "auth_insert_party_participants"
  ON watch_party_participants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_party_participants" ON watch_party_participants;
CREATE POLICY "own_delete_party_participants"
  ON watch_party_participants FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 7. ADD COLUMNS TO VIDEOS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'is_premium') THEN
    ALTER TABLE videos ADD COLUMN is_premium boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'is_member_only') THEN
    ALTER TABLE videos ADD COLUMN is_member_only boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'premiere_at') THEN
    ALTER TABLE videos ADD COLUMN premiere_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'scheduled_at') THEN
    ALTER TABLE videos ADD COLUMN scheduled_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'videos' AND column_name = 'download_count') THEN
    ALTER TABLE videos ADD COLUMN download_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- 8. ADD COLUMNS TO PROFILES
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_premium') THEN
    ALTER TABLE profiles ADD COLUMN is_premium boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'is_eligible_creator') THEN
    ALTER TABLE profiles ADD COLUMN is_eligible_creator boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'monetization_approved') THEN
    ALTER TABLE profiles ADD COLUMN monetization_approved boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ============================================================
-- 9. ADD INDEXES TO live_streams
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_creator ON live_streams(creator_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_is_featured ON live_streams(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_live_streams_scheduled ON live_streams(scheduled_start) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_live_chat_stream ON live_chat_messages(stream_id, created_at);
CREATE INDEX IF NOT EXISTS idx_live_chat_pinned ON live_chat_messages(stream_id) WHERE is_pinned = true;

-- ============================================================
-- 10. ENSURE RLS POLICIES ON EXISTING TABLES
-- ============================================================

-- live_streams policies
DROP POLICY IF EXISTS "public_read_live_streams" ON live_streams;
CREATE POLICY "public_read_live_streams"
  ON live_streams FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "creator_insert_live_streams" ON live_streams;
CREATE POLICY "creator_insert_live_streams"
  ON live_streams FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "creator_update_live_streams" ON live_streams;
CREATE POLICY "creator_update_live_streams"
  ON live_streams FOR UPDATE
  TO authenticated USING (
    auth.uid() = creator_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  ) WITH CHECK (
    auth.uid() = creator_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "creator_admin_delete_live_streams" ON live_streams;
CREATE POLICY "creator_admin_delete_live_streams"
  ON live_streams FOR DELETE
  TO authenticated USING (
    auth.uid() = creator_id
    OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- live_chat_messages policies
DROP POLICY IF EXISTS "public_read_live_chat" ON live_chat_messages;
CREATE POLICY "public_read_live_chat"
  ON live_chat_messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "auth_insert_live_chat" ON live_chat_messages;
CREATE POLICY "auth_insert_live_chat"
  ON live_chat_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_delete_live_chat" ON live_chat_messages;
CREATE POLICY "own_delete_live_chat"
  ON live_chat_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "creator_admin_moderate_live_chat" ON live_chat_messages;
CREATE POLICY "creator_admin_moderate_live_chat"
  ON live_chat_messages FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM live_streams ls
      WHERE ls.id = live_chat_messages.stream_id
      AND (ls.creator_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
    )
  );

DROP POLICY IF EXISTS "creator_admin_update_live_chat" ON live_chat_messages;
CREATE POLICY "creator_admin_update_live_chat"
  ON live_chat_messages FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM live_streams ls
      WHERE ls.id = live_chat_messages.stream_id
      AND (ls.creator_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
    )
  ) WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM live_streams ls
      WHERE ls.id = live_chat_messages.stream_id
      AND (ls.creator_id = auth.uid()
           OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true))
    )
  );

-- channel_memberships policies
DROP POLICY IF EXISTS "public_read_memberships" ON channel_memberships;
CREATE POLICY "public_read_memberships"
  ON channel_memberships FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "owner_insert_memberships" ON channel_memberships;
CREATE POLICY "owner_insert_memberships"
  ON channel_memberships FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() = member_id);

DROP POLICY IF EXISTS "owner_update_memberships" ON channel_memberships;
CREATE POLICY "owner_update_memberships"
  ON channel_memberships FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = member_id) WITH CHECK (auth.uid() = user_id OR auth.uid() = member_id);

DROP POLICY IF EXISTS "owner_delete_memberships" ON channel_memberships;
CREATE POLICY "owner_delete_memberships"
  ON channel_memberships FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR auth.uid() = member_id);

-- donations policies
DROP POLICY IF EXISTS "public_read_donations" ON donations;
CREATE POLICY "public_read_donations"
  ON donations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sender_insert_donations" ON donations;
CREATE POLICY "sender_insert_donations"
  ON donations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = sender_id OR auth.uid() = donor_id);

-- platform_settings policies
DROP POLICY IF EXISTS "public_read_platform_settings" ON platform_settings;
CREATE POLICY "public_read_platform_settings"
  ON platform_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "admin_update_platform_settings" ON platform_settings;
CREATE POLICY "admin_update_platform_settings"
  ON platform_settings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- ============================================================
-- 11. TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION notify_subscribers_on_live()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'live' AND OLD.status != 'live') THEN
    INSERT INTO notifications (user_id, type, title, body, video_id)
    SELECT
      s.subscriber_id,
      'live',
      'Live Now',
      NEW.title || ' is now live!',
      NULL
    FROM subscriptions s
    WHERE s.channel_id = NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_subscribers_on_live ON live_streams;
CREATE TRIGGER trg_notify_subscribers_on_live
  AFTER UPDATE ON live_streams
  FOR EACH ROW
  EXECUTE FUNCTION notify_subscribers_on_live();

CREATE OR REPLACE FUNCTION notify_subscribers_on_premiere()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.premiere = true AND NEW.published = false) THEN
    INSERT INTO notifications (user_id, type, title, body, video_id)
    SELECT
      s.subscriber_id,
      'premiere',
      'Upcoming Premiere',
      'A new premiere is scheduled',
      NEW.video_id
    FROM subscriptions s
    WHERE s.channel_id = NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_subscribers_on_premiere ON video_schedules;
CREATE TRIGGER trg_notify_subscribers_on_premiere
  AFTER INSERT ON video_schedules
  FOR EACH ROW
  WHEN (NEW.premiere = true)
  EXECUTE FUNCTION notify_subscribers_on_premiere();

CREATE OR REPLACE FUNCTION notify_on_scheduled_publish()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.published = true AND OLD.published = false) THEN
    INSERT INTO notifications (user_id, type, title, body, video_id)
    SELECT
      s.subscriber_id,
      'scheduled_publish',
      'New Video',
      'A new video has been published',
      NEW.video_id
    FROM subscriptions s
    WHERE s.channel_id = NEW.creator_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_scheduled_publish ON video_schedules;
CREATE TRIGGER trg_notify_on_scheduled_publish
  AFTER UPDATE ON video_schedules
  FOR EACH ROW
  WHEN (NEW.published = true AND OLD.published = false)
  EXECUTE FUNCTION notify_on_scheduled_publish();

-- ============================================================
-- 12. RPCs
-- ============================================================

CREATE OR REPLACE FUNCTION publish_scheduled_videos()
RETURNS integer AS $$
DECLARE
  published_count integer := 0;
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT vs.id, vs.video_id
    FROM video_schedules vs
    WHERE vs.published = false
    AND vs.scheduled_at <= now()
  LOOP
    UPDATE videos SET status = 'published', updated_at = now() WHERE id = rec.video_id AND status = 'draft';
    UPDATE video_schedules SET published = true, countdown_started = true WHERE id = rec.id;
    published_count := published_count + 1;
  END LOOP;
  RETURN published_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_live_streams(p_status text DEFAULT 'live', p_limit integer DEFAULT 20)
RETURNS TABLE (
  id uuid,
  creator_id uuid,
  title text,
  description text,
  thumbnail_url text,
  stream_url text,
  status text,
  is_premium boolean,
  is_member_only boolean,
  scheduled_start timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  viewer_count integer,
  peak_viewers integer,
  is_featured boolean,
  chat_enabled boolean,
  created_at timestamptz,
  creator_name text,
  creator_avatar text,
  subscriber_count bigint
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.id,
    ls.creator_id,
    ls.title,
    ls.description,
    ls.thumbnail_url,
    COALESCE(ls.stream_url, ''::text),
    ls.status,
    ls.is_premium,
    COALESCE(ls.is_member_only, false),
    ls.scheduled_start,
    ls.started_at,
    ls.ended_at,
    ls.viewer_count,
    ls.peak_viewers,
    COALESCE(ls.is_featured, ls.featured, false),
    COALESCE(ls.chat_enabled, true),
    ls.created_at,
    p.full_name AS creator_name,
    p.avatar_url AS creator_avatar,
    (SELECT COUNT(*) FROM subscriptions WHERE channel_id = ls.creator_id)::bigint AS subscriber_count
  FROM live_streams ls
  LEFT JOIN profiles p ON p.id = ls.creator_id
  WHERE (p_status = 'all' OR ls.status = p_status)
  ORDER BY
    CASE WHEN COALESCE(ls.is_featured, ls.featured) THEN 0 ELSE 1 END,
    CASE WHEN ls.status = 'live' THEN ls.started_at ELSE ls.scheduled_start END DESC NULLS LAST
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_creator_analytics_extended(p_user_id uuid)
RETURNS TABLE (
  total_views bigint,
  total_likes bigint,
  total_comments bigint,
  total_subscribers bigint,
  total_downloads bigint,
  avg_watch_time numeric,
  total_watch_time numeric,
  live_viewers bigint,
  total_streams bigint,
  returning_viewers bigint,
  estimated_revenue numeric,
  ad_revenue numeric,
  premium_revenue numeric,
  donations_revenue numeric,
  membership_revenue numeric
)
AS $$
DECLARE
  v_total_views bigint;
  v_total_likes bigint;
  v_total_comments bigint;
  v_total_subscribers bigint;
  v_total_downloads bigint;
  v_avg_watch numeric;
  v_total_watch numeric;
  v_live_viewers bigint;
  v_total_streams bigint;
  v_returning_viewers bigint;
BEGIN
  SELECT COUNT(*) INTO v_total_views FROM video_views WHERE video_id IN (SELECT id FROM videos WHERE uploader_id = p_user_id);
  SELECT COUNT(*) INTO v_total_likes FROM video_likes WHERE video_id IN (SELECT id FROM videos WHERE uploader_id = p_user_id);
  SELECT COUNT(*) INTO v_total_comments FROM comments WHERE video_id IN (SELECT id FROM videos WHERE uploader_id = p_user_id);
  SELECT COUNT(*) INTO v_total_subscribers FROM subscriptions WHERE channel_id = p_user_id;
  SELECT COUNT(*) INTO v_total_downloads FROM downloads WHERE video_id IN (SELECT id FROM videos WHERE uploader_id = p_user_id);
  SELECT COALESCE(AVG(watch_duration), 0) INTO v_avg_watch FROM video_views WHERE video_id IN (SELECT id FROM videos WHERE uploader_id = p_user_id);
  SELECT COALESCE(SUM(watch_duration), 0) INTO v_total_watch FROM video_views WHERE video_id IN (SELECT id FROM videos WHERE uploader_id = p_user_id);
  SELECT COALESCE(SUM(viewer_count), 0) INTO v_live_viewers FROM live_streams WHERE creator_id = p_user_id AND status = 'live';
  SELECT COUNT(*) INTO v_total_streams FROM live_streams WHERE creator_id = p_user_id;
  SELECT COALESCE(COUNT(*), 0) INTO v_returning_viewers FROM (
    SELECT user_id FROM video_views WHERE user_id IS NOT NULL AND video_id IN (SELECT id FROM videos WHERE uploader_id = p_user_id) GROUP BY user_id HAVING COUNT(*) > 1
  ) sub;

  RETURN QUERY
  SELECT
    COALESCE(v_total_views, 0),
    COALESCE(v_total_likes, 0),
    COALESCE(v_total_comments, 0),
    COALESCE(v_total_subscribers, 0),
    COALESCE(v_total_downloads, 0),
    COALESCE(v_avg_watch, 0),
    COALESCE(v_total_watch, 0),
    COALESCE(v_live_viewers, 0),
    COALESCE(v_total_streams, 0),
    COALESCE(v_returning_viewers, 0),
    0::numeric AS estimated_revenue,
    0::numeric AS ad_revenue,
    0::numeric AS premium_revenue,
    0::numeric AS donations_revenue,
    0::numeric AS membership_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;