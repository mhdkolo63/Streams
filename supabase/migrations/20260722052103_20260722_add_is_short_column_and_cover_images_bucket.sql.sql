/*
# Add is_short column for server-side short classification
# Fix avatars bucket size limit
# Create cover-images bucket for channel banners
*/

-- 1. Add is_short column to videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_short boolean NOT NULL DEFAULT false;

-- Index for fast shorts queries
CREATE INDEX IF NOT EXISTS idx_videos_is_short_published ON videos(is_short, status) WHERE status = 'published';

-- 2. Backfill existing videos: duration <= 60 OR aspect_ratio = '9:16' => is_short = true
UPDATE videos
SET is_short = true
WHERE (duration <= 60 AND duration > 0) OR aspect_ratio = '9:16';

-- 3. Auto-classify trigger on INSERT and UPDATE
CREATE OR REPLACE FUNCTION auto_classify_short()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-classify: duration <= 60 or aspect_ratio = '9:16' means short
  IF NEW.duration > 0 AND NEW.duration <= 60 THEN
    NEW.is_short := true;
  ELSIF NEW.aspect_ratio = '9:16' THEN
    NEW.is_short := true;
  ELSE
    NEW.is_short := false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_classify_short ON videos;
CREATE TRIGGER trg_auto_classify_short
  BEFORE INSERT OR UPDATE OF duration, aspect_ratio ON videos
  FOR EACH ROW EXECUTE FUNCTION auto_classify_short();

-- 4. Fix avatars bucket size to 10MB
UPDATE storage.buckets SET file_size_limit = 10485760 WHERE id = 'avatars';

-- 5. Create cover-images bucket for channel banners
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('cover-images', 'cover-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Cover-images storage policies
DROP POLICY IF EXISTS "cover_images_public_select" ON storage.objects;
CREATE POLICY "cover_images_public_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'cover-images');

DROP POLICY IF EXISTS "cover_images_owner_insert" ON storage.objects;
CREATE POLICY "cover_images_owner_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'cover-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "cover_images_owner_update" ON storage.objects;
CREATE POLICY "cover_images_owner_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cover-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'cover-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "cover_images_owner_delete" ON storage.objects;
CREATE POLICY "cover_images_owner_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'cover-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );