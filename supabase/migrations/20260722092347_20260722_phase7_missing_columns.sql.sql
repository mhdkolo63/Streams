/*
# Phase 7: Add missing columns for channel & creator experience
# Most infrastructure already exists from prior phases
*/

-- Profiles: add language, cover_url, social_links (jsonb for quick access alongside channel_social_links table)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'English';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cover_url text;

-- Playlists: add is_system and system_type for Watch Later / Liked Videos / History
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS is_system boolean DEFAULT false;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS system_type text;
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Make user_id nullable for backwards compat (existing rows use creator_id)
-- New system playlists will use user_id

-- Comments: add is_reported column (is_pinned, is_hearted, edited_at already exist)
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_reported boolean DEFAULT false;

-- Comment reports table
CREATE TABLE IF NOT EXISTS comment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, reporter_id)
);

ALTER TABLE comment_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_comment_reports" ON comment_reports FOR SELECT
  TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "insert_own_comment_report" ON comment_reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "delete_own_comment_report" ON comment_reports FOR DELETE
  TO authenticated USING (auth.uid() = reporter_id);

-- Shares table already exists; add share_via column for tracking
ALTER TABLE shares ADD COLUMN IF NOT EXISTS share_via text;