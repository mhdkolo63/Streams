/*
# StreamWorld Phase 2: Creator Studio RLS

## Goal
Allow authenticated (non-admin) users to upload, edit, and delete their own
videos, thumbnails, and video file assets — while keeping admin control intact.

## Changes

### 1. Table RLS: `videos`
- Creators can INSERT rows where `uploader_id = auth.uid()`
- Creators can UPDATE rows where `uploader_id = auth.uid()`
- Creators can DELETE rows where `uploader_id = auth.uid()`
- Public SELECT now includes `unlisted` status (visible to anyone with the link)
  AND rows owned by the creator (so they see their own private/draft content)
- Admin policies remain unchanged (admin can do everything)

### 2. Table RLS: `video_categories`
- Creators can INSERT/DELETE rows for videos they own
- Public SELECT now includes `unlisted` videos

### 3. Storage: `videos` bucket
- Creators can INSERT objects under `{user_id}/` prefix
- Creators can UPDATE/DELETE their own objects under `{user_id}/` prefix
- Admin policies remain unchanged

### 4. Storage: `thumbnails` bucket
- Creators can INSERT objects under `{user_id}/` prefix
- Creators can UPDATE/DELETE their own objects under `{user_id}/` prefix
- Admin policies remain unchanged

### 5. Profiles
- Allow users to update their own `bio` and `banner_url` (already covered by
  existing `update_own_profiles_safe` policy — no change needed).
*/

-- =============================================================
-- 1. Videos table: creator policies
-- =============================================================

-- Creators can insert their own videos
CREATE POLICY "videos_creator_insert"
  ON videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = uploader_id);

-- Creators can update their own videos
CREATE POLICY "videos_creator_update"
  ON videos FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploader_id)
  WITH CHECK (auth.uid() = uploader_id);

-- Creators can delete their own videos
CREATE POLICY "videos_creator_delete"
  ON videos FOR DELETE
  TO authenticated
  USING (auth.uid() = uploader_id);

-- Replace public read to include unlisted + own videos
DROP POLICY IF EXISTS "videos_public_read" ON videos;
CREATE POLICY "videos_public_read"
  ON videos FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    OR status = 'unlisted'
    OR (auth.uid() IS NOT NULL AND auth.uid() = uploader_id)
  );

-- =============================================================
-- 2. video_categories table: creator policies
-- =============================================================

-- Creators can link categories to their own videos
CREATE POLICY "video_categories_creator_insert"
  ON video_categories FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM videos v
      WHERE v.id = video_categories.video_id
      AND v.uploader_id = auth.uid()
    )
  );

-- Creators can delete category links for their own videos
CREATE POLICY "video_categories_creator_delete"
  ON video_categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos v
      WHERE v.id = video_categories.video_id
      AND v.uploader_id = auth.uid()
    )
  );

-- Replace public read to include unlisted
DROP POLICY IF EXISTS "video_categories_public_read" ON video_categories;
CREATE POLICY "video_categories_public_read"
  ON video_categories FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM videos v
      WHERE v.id = video_categories.video_id
      AND (v.status = 'published' OR v.status = 'unlisted')
    )
  );

-- =============================================================
-- 3. Storage: videos bucket — creator policies (folder-scoped)
-- =============================================================

CREATE POLICY "videos_creator_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "videos_creator_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "videos_creator_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'videos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================
-- 4. Storage: thumbnails bucket — creator policies (folder-scoped)
-- =============================================================

CREATE POLICY "thumbnails_creator_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "thumbnails_creator_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "thumbnails_creator_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'thumbnails'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
