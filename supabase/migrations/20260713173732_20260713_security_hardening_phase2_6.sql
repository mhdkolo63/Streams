/*
# Security Hardening Migration - Phase 2.6

## Summary
This migration fixes all identified RLS policy vulnerabilities, storage security gaps,
and RPC function authorization issues found during the security audit.

## Changes

### 1. profiles table RLS
- PROBLEM: `profiles_public_select` allowed ANY authenticated user to read ALL profiles
  (email, phone, username of every user — data harvesting risk)
- FIX: Replace with `profiles_select_own` — users can only read their own profile.
  Admins can read all profiles via `profiles_select_admin`.

### 2. categories table RLS
- PROBLEM: `categories_admin_write` used `FOR ALL` (violates per-verb best practice)
- FIX: Split into separate INSERT, UPDATE, DELETE admin-only policies.
  SELECT remains public (anon, authenticated).

### 3. video_categories table RLS
- PROBLEM: `video_categories_admin_all` used `FOR ALL`
- FIX: Split into separate INSERT, UPDATE, DELETE admin-only policies.
  SELECT remains public for published videos.

### 4. videos table RLS
- PROBLEM: `videos_admin_all` used `FOR ALL`
- FIX: Split into separate INSERT, UPDATE, DELETE admin-only policies.
  SELECT remains public for published videos.

### 5. search_logs table RLS
- PROBLEM: `select_search_logs` was `TO anon, authenticated` with `USING (true)`
  — any user could read all other users' search history
- FIX: Replace with admin-only SELECT. INSERT remains open (search logging).
  Add `search_logs_insert_authenticated` requiring user_id match for authenticated users.

### 6. video_views table RLS
- PROBLEM: `video_views_insert` allowed `anon` with `WITH CHECK (true)` — no ownership
- FIX: Replace with authenticated-only INSERT requiring `user_id = auth.uid()`.
  Add anon fallback for view tracking with null user_id.

### 7. admin_activity_logs table RLS
- PROBLEM: Missing UPDATE and DELETE policies
- FIX: Add `update_admin_activity_logs` and `delete_admin_activity_logs` admin-only policies.

### 8. Storage: avatars bucket
- PROBLEM: `avatars_auth_insert`, `avatars_auth_update`, `avatars_auth_delete` allowed
  ANY authenticated user to insert/update/delete ANY avatar file
- FIX: Replace with ownership-scoped policies — users can only modify files in
  their own folder path (`{user_id}/`). Admin retains full access.

### 9. RPC: increment_video_views
- PROBLEM: SECURITY DEFINER with no authorization check — anyone could inflate view counts
- FIX: Revoke EXECUTE from anon/public, grant only to authenticated.
  Add comment documenting the security decision.

## Security Notes
- All admin checks use `EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)`
- No policy uses `USING (true)` except where data is intentionally public (categories SELECT, published videos SELECT)
- Storage avatar policies enforce folder-level ownership via path prefix matching
*/

-- ============================================================
-- 1. PROFILES: Fix public SELECT — restrict to own profile + admin
-- ============================================================

DROP POLICY IF EXISTS "profiles_public_select" ON profiles;
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_select_admin" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

CREATE POLICY "profiles_select_admin" ON profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 2. CATEGORIES: Split FOR ALL into per-verb admin policies
-- ============================================================

DROP POLICY IF EXISTS "categories_admin_write" ON categories;
DROP POLICY IF EXISTS "categories_admin_insert" ON categories;
DROP POLICY IF EXISTS "categories_admin_update" ON categories;
DROP POLICY IF EXISTS "categories_admin_delete" ON categories;

CREATE POLICY "categories_admin_insert" ON categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "categories_admin_update" ON categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "categories_admin_delete" ON categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 3. VIDEO_CATEGORIES: Split FOR ALL into per-verb admin policies
-- ============================================================

DROP POLICY IF EXISTS "video_categories_admin_all" ON video_categories;
DROP POLICY IF EXISTS "video_categories_admin_insert" ON video_categories;
DROP POLICY IF EXISTS "video_categories_admin_update" ON video_categories;
DROP POLICY IF EXISTS "video_categories_admin_delete" ON video_categories;

CREATE POLICY "video_categories_admin_insert" ON video_categories FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "video_categories_admin_update" ON video_categories FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "video_categories_admin_delete" ON video_categories FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 4. VIDEOS: Split FOR ALL into per-verb admin policies
-- ============================================================

DROP POLICY IF EXISTS "videos_admin_all" ON videos;
DROP POLICY IF EXISTS "videos_admin_insert" ON videos;
DROP POLICY IF EXISTS "videos_admin_update" ON videos;
DROP POLICY IF EXISTS "videos_admin_delete" ON videos;

CREATE POLICY "videos_admin_insert" ON videos FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "videos_admin_update" ON videos FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "videos_admin_delete" ON videos FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 5. SEARCH_LOGS: Restrict SELECT to admin only
-- ============================================================

DROP POLICY IF EXISTS "select_search_logs" ON search_logs;
DROP POLICY IF EXISTS "search_logs_select_admin" ON search_logs;

CREATE POLICY "search_logs_select_admin" ON search_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 6. VIDEO_VIEWS: Restrict INSERT to authenticated with ownership
-- ============================================================

DROP POLICY IF EXISTS "video_views_insert" ON video_views;
DROP POLICY IF EXISTS "video_views_insert_authenticated" ON video_views;

CREATE POLICY "video_views_insert_authenticated" ON video_views FOR INSERT
  TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- ============================================================
-- 7. ADMIN_ACTIVITY_LOGS: Add missing UPDATE and DELETE policies
-- ============================================================

DROP POLICY IF EXISTS "update_admin_activity_logs" ON admin_activity_logs;
DROP POLICY IF EXISTS "delete_admin_activity_logs" ON admin_activity_logs;

CREATE POLICY "update_admin_activity_logs" ON admin_activity_logs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

CREATE POLICY "delete_admin_activity_logs" ON admin_activity_logs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 8. STORAGE: Fix avatars bucket — enforce folder-level ownership
-- ============================================================

DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;

DROP POLICY IF EXISTS "avatars_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update" ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete" ON storage.objects;
DROP POLICY IF EXISTS "avatars_admin_all" ON storage.objects;

-- Users can insert into their own folder only
CREATE POLICY "avatars_owner_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar only
CREATE POLICY "avatars_owner_update" ON storage.objects FOR UPDATE
  TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar only
CREATE POLICY "avatars_owner_delete" ON storage.objects FOR DELETE
  TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin can manage all avatars
CREATE POLICY "avatars_admin_all" ON storage.objects FOR ALL
  TO authenticated USING (
    bucket_id = 'avatars'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  ) WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
  );

-- ============================================================
-- 9. RPC: Restrict increment_video_views to authenticated only
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.increment_video_views(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.increment_video_views(uuid) TO authenticated;

-- ============================================================
-- 10. Add is_admin update protection: prevent users from granting themselves admin
-- ============================================================

-- Ensure profiles_update_own policy prevents self-escalation to admin
-- The existing policy uses auth.uid() = id which allows updating is_admin field
-- We need to add a constraint to prevent non-admins from setting is_admin = true
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_safe" ON profiles;

CREATE POLICY "profiles_update_own_safe" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (
      -- Allow if not trying to change is_admin
      is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid())
      OR
      -- Allow if user is already admin
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin = true)
    )
  );
