/*
# Fix storage: create avatars bucket + relax videos bucket MIME restriction

## Problems
1. No `avatars` bucket exists — profile picture uploads fail with "Load Failed"
2. `videos` bucket has restrictive allowed_mime_types that reject common
   extensions (e.g. code sends `video/mov` but bucket requires `video/quicktime`)

## Changes
1. Remove allowed_mime_types restriction on `videos` bucket (validation is
   already done in application code via VALIDATION.videoFile)
2. Create `avatars` bucket (public, 10 MB, jpg/png/webp/gif)
3. Add storage policies for `avatars` bucket — users can manage their own
   folder, public read for everyone
*/

-- 1. Relax videos bucket MIME restriction
UPDATE storage.buckets
SET allowed_mime_types = null
WHERE id = 'videos';

-- 2. Create avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- 3. Avatars storage policies

-- Public read
DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_public_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Authenticated users can INSERT into their own folder
DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can UPDATE their own avatar (for upsert / replace)
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can DELETE their own avatar
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );