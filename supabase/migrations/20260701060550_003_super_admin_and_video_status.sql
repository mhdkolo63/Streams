-- Add super_admin flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Set haskedolo@gmail.com as super admin
UPDATE profiles 
SET is_super_admin = TRUE, is_admin = TRUE 
WHERE email = 'haskedolo@gmail.com';

-- Ensure videos table has proper status constraints
ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_status_check;
ALTER TABLE videos ADD CONSTRAINT videos_status_check 
  CHECK (status IN ('draft', 'published', 'unpublished'));

-- Update existing videos to published if they don't have a status
UPDATE videos SET status = 'published' WHERE status IS NULL OR status = '';