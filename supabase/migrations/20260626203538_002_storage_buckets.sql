/*
# Create Storage Buckets for StreamFlix

Create two storage buckets:
1. videos - For storing video files (MP4, MOV, MKV, etc.)
2. thumbnails - For storing thumbnail images

Security policies:
- Videos: Public read, admin write only
- Thumbnails: Public read, admin write only
*/

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('videos', 'videos', true, 5242880000, ARRAY['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/avi']),
  ('thumbnails', 'thumbnails', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for videos bucket
DROP POLICY IF EXISTS "videos_public_select" ON storage.objects;
CREATE POLICY "videos_public_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "videos_admin_insert" ON storage.objects;
CREATE POLICY "videos_admin_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'videos' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "videos_admin_update" ON storage.objects;
CREATE POLICY "videos_admin_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'videos' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "videos_admin_delete" ON storage.objects;
CREATE POLICY "videos_admin_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'videos' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Storage policies for thumbnails bucket
DROP POLICY IF EXISTS "thumbnails_public_select" ON storage.objects;
CREATE POLICY "thumbnails_public_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'thumbnails');

DROP POLICY IF EXISTS "thumbnails_admin_insert" ON storage.objects;
CREATE POLICY "thumbnails_admin_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'thumbnails' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "thumbnails_admin_update" ON storage.objects;
CREATE POLICY "thumbnails_admin_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'thumbnails' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

DROP POLICY IF EXISTS "thumbnails_admin_delete" ON storage.objects;
CREATE POLICY "thumbnails_admin_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'thumbnails' AND
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );