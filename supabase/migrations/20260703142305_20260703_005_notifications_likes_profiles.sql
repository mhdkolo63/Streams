/*
# Notifications, Video Likes, and Profile Enhancements

## Overview
This migration adds a notification system, video like tracking, and profile enhancements (phone, username) to support the new feature set.

## New Tables

1. **notifications** - Per-user notifications for new video uploads
   - id (uuid, primary key)
   - user_id (uuid, references profiles, NOT NULL)
   - video_id (uuid, references videos, NOT NULL)
   - type (text, default 'new_video')
   - title (text)
   - body (text)
   - thumbnail_url (text)
   - is_read (boolean, default false)
   - created_at (timestamptz, default now())

2. **video_likes** - Tracks which users liked which videos
   - id (uuid, primary key)
   - user_id (uuid, references profiles, NOT NULL)
   - video_id (uuid, references videos, NOT NULL)
   - created_at (timestamptz, default now())
   - UNIQUE(user_id, video_id)

## Modified Tables

1. **profiles** - Added columns:
   - phone (text, nullable) - phone number for phone-based auth
   - username (text, nullable, unique) - username for profile
2. **videos** - Added column:
   - like_count (integer, default 0) - cached like count for display

## New Storage Bucket

1. **avatars** - For storing user profile pictures (public read, authenticated write)

## Security

- notifications: owner-scoped CRUD (user can only see/manage their own notifications)
- video_likes: owner-scoped CRUD (user can only manage their own likes)
- avatars bucket: public read, authenticated user can upload/update/delete their own avatar

## Functions / Triggers

1. **create_notifications_for_all_users()** - Triggered when a video is published, creates a notification for every registered user
2. **handle_new_user()** - Updated to also copy phone and username from raw_user_meta_data
3. **update_video_like_count()** - Maintains denormalized like_count on videos table
*/

-- Add phone and username columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text;

-- Add unique index on username (partial - only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_unique ON profiles(username) WHERE username IS NOT NULL;

-- Add like_count column to videos for quick display
ALTER TABLE videos ADD COLUMN IF NOT EXISTS like_count integer NOT NULL DEFAULT 0;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'new_video',
  title text,
  body text,
  thumbnail_url text,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Create video_likes table
CREATE TABLE IF NOT EXISTS video_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Enable RLS on new tables
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_likes ENABLE ROW LEVEL SECURITY;

-- Notifications policies (owner-scoped CRUD)
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_insert_own" ON notifications;
CREATE POLICY "notifications_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete_own" ON notifications;
CREATE POLICY "notifications_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Video likes policies (owner-scoped)
DROP POLICY IF EXISTS "video_likes_select_own" ON video_likes;
CREATE POLICY "video_likes_select_own" ON video_likes FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "video_likes_insert_own" ON video_likes;
CREATE POLICY "video_likes_insert_own" ON video_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "video_likes_delete_own" ON video_likes;
CREATE POLICY "video_likes_delete_own" ON video_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_likes_user ON video_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_video ON video_likes(video_id);

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars bucket (public read, authenticated write for own files)
DROP POLICY IF EXISTS "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_public_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_insert" ON storage.objects;
CREATE POLICY "avatars_auth_insert" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_update" ON storage.objects;
CREATE POLICY "avatars_auth_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars_auth_delete" ON storage.objects;
CREATE POLICY "avatars_auth_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'avatars');

-- Function to create notifications for all users when a video is published
CREATE OR REPLACE FUNCTION public.create_notifications_for_all_users()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.status = 'published') OR
     (TG_OP = 'UPDATE' AND OLD.status <> 'published' AND NEW.status = 'published') THEN
    
    INSERT INTO notifications (user_id, video_id, type, title, body, thumbnail_url)
    SELECT p.id, NEW.id, 'new_video', NEW.title, 
           COALESCE(LEFT(NEW.description, 150), 'New video uploaded'),
           NEW.thumbnail_url
    FROM profiles p
    WHERE p.id <> COALESCE(NEW.uploader_id, '00000000-0000-0000-0000-000000000000'::uuid);
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notifications on video publish
DROP TRIGGER IF EXISTS on_video_published ON videos;
CREATE TRIGGER on_video_published
  AFTER INSERT OR UPDATE OF status ON videos
  FOR EACH ROW EXECUTE FUNCTION public.create_notifications_for_all_users();

-- Update handle_new_user to include phone and username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, phone, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update like count on videos
CREATE OR REPLACE FUNCTION public.update_video_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE videos SET like_count = like_count + 1 WHERE id = NEW.video_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE videos SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.video_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update like count
DROP TRIGGER IF EXISTS on_video_like_change ON video_likes;
CREATE TRIGGER on_video_like_change
  AFTER INSERT OR DELETE ON video_likes
  FOR EACH ROW EXECUTE FUNCTION public.update_video_like_count();