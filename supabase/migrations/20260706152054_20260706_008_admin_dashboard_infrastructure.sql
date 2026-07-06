-- Admin activity logs table
CREATE TABLE IF NOT EXISTS admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  description text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_admin_activity_logs" ON admin_activity_logs
  FOR SELECT TO authenticated USING (auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  ));

CREATE POLICY "insert_admin_activity_logs" ON admin_activity_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  ));

CREATE INDEX IF NOT EXISTS admin_activity_logs_created_at_idx ON admin_activity_logs (created_at DESC);

-- Add user management columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_login timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS watch_time integer DEFAULT 0;

-- Add sort order to categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order integer DEFAULT 0;

-- Add category image URL
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_url text;
