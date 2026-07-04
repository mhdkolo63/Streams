/*
# StreamFlix Video Streaming Platform Schema

This migration creates the complete database schema for a Netflix-style video streaming platform.

## Tables Created

1. **profiles** - User profiles extending Supabase auth.users
   - id (uuid, primary key, references auth.users)
   - email (text, unique)
   - full_name (text)
   - avatar_url (text)
   - is_admin (boolean, default false)
   - created_at, updated_at (timestamps)

2. **categories** - Video categories (Action, Comedy, Drama, etc.)
   - id (uuid, primary key)
   - name (text, unique)
   - slug (text, unique)
   - description (text)
   - created_at (timestamp)

3. **videos** - Main video content table
   - id (uuid, primary key)
   - title (text, not null)
   - description (text)
   - video_url (text, not null) - Supabase Storage URL
   - thumbnail_url (text)
   - duration (integer) - in seconds
   - release_year (integer)
   - genre (text)
   - featured (boolean, default false) - pinned on homepage
   - views_count (integer, default 0)
   - uploader_id (uuid, references profiles) - admin who uploaded
   - created_at, updated_at (timestamps)

4. **video_categories** - Many-to-many relationship
   - video_id (uuid, references videos)
   - category_id (uuid, references categories)

5. **watch_history** - Track viewing progress per user
   - id (uuid, primary key)
   - user_id (uuid, references profiles)
   - video_id (uuid, references videos)
   - progress (integer) - seconds watched
   - completed (boolean, default false)
   - last_watched_at (timestamp)

6. **favorites** - User watchlists
   - id (uuid, primary key)
   - user_id (uuid, references profiles)
   - video_id (uuid, references videos)
   - created_at (timestamp)

7. **video_views** - Analytics for all views
   - id (uuid, primary key)
   - video_id (uuid, references videos)
   - user_id (uuid, references profiles, nullable) - null for anonymous
   - viewed_at (timestamp)
   - watch_duration (integer)

## Security

- RLS enabled on all tables
- Profiles: users can read own data, admins have full access
- Categories: public read, admin write
- Videos: public read, admin write
- Watch history: user-scoped CRUD
- Favorites: user-scoped CRUD
- Video views: insert for all, read for admins

## Indexes

- Indexes on frequently queried columns for performance
*/

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon_name text,
  created_at timestamptz DEFAULT now()
);

-- Videos table
CREATE TABLE IF NOT EXISTS videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text NOT NULL,
  thumbnail_url text,
  trailer_url text,
  duration integer NOT NULL DEFAULT 0,
  release_year integer,
  genre text,
  rating text,
  video_cast text[],
  director text,
  featured boolean NOT NULL DEFAULT false,
  trending boolean NOT NULL DEFAULT false,
  views_count integer NOT NULL DEFAULT 0,
  uploader_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Video categories junction table
CREATE TABLE IF NOT EXISTS video_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(video_id, category_id)
);

-- Watch history table
CREATE TABLE IF NOT EXISTS watch_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  progress integer NOT NULL DEFAULT 0,
  completed boolean NOT NULL DEFAULT false,
  last_watched_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Favorites/Watchlist table
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, video_id)
);

-- Video views analytics table
CREATE TABLE IF NOT EXISTS video_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now(),
  watch_duration integer NOT NULL DEFAULT 0,
  ip_address text,
  user_agent text,
  country text
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_videos_featured ON videos(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_videos_trending ON videos(trending) WHERE trending = true;
CREATE INDEX IF NOT EXISTS idx_videos_status ON videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_views ON videos(views_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_genre ON videos(genre);
CREATE INDEX IF NOT EXISTS idx_videos_release_year ON videos(release_year DESC);
CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_video ON watch_history(video_id);
CREATE INDEX IF NOT EXISTS idx_watch_history_watched ON watch_history(last_watched_at DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_video ON favorites(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_video ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_user ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_video_views_viewed ON video_views(viewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_admin ON profiles(is_admin) WHERE is_admin = true;

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE watch_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_views ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_public_select" ON profiles;
CREATE POLICY "profiles_public_select" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Categories policies (public read, admin write)
DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_admin_write" ON categories;
CREATE POLICY "categories_admin_write" ON categories FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Videos policies (public read for published, admin write)
DROP POLICY IF EXISTS "videos_public_read" ON videos;
CREATE POLICY "videos_public_read" ON videos FOR SELECT
  TO anon, authenticated USING (status = 'published');

DROP POLICY IF EXISTS "videos_admin_all" ON videos;
CREATE POLICY "videos_admin_all" ON videos FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Video categories policies
DROP POLICY IF EXISTS "video_categories_public_read" ON video_categories;
CREATE POLICY "video_categories_public_read" ON video_categories FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM videos WHERE videos.id = video_categories.video_id AND videos.status = 'published')
  );

DROP POLICY IF EXISTS "video_categories_admin_all" ON video_categories;
CREATE POLICY "video_categories_admin_all" ON video_categories FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Watch history policies (user-scoped)
DROP POLICY IF EXISTS "watch_history_select_own" ON watch_history;
CREATE POLICY "watch_history_select_own" ON watch_history FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "watch_history_insert_own" ON watch_history;
CREATE POLICY "watch_history_insert_own" ON watch_history FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "watch_history_update_own" ON watch_history;
CREATE POLICY "watch_history_update_own" ON watch_history FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "watch_history_delete_own" ON watch_history;
CREATE POLICY "watch_history_delete_own" ON watch_history FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Favorites policies (user-scoped)
DROP POLICY IF EXISTS "favorites_select_own" ON favorites;
CREATE POLICY "favorites_select_own" ON favorites FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_insert_own" ON favorites;
CREATE POLICY "favorites_insert_own" ON favorites FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "favorites_delete_own" ON favorites;
CREATE POLICY "favorites_delete_own" ON favorites FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Video views policies
DROP POLICY IF EXISTS "video_views_insert" ON video_views;
CREATE POLICY "video_views_insert" ON video_views FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "video_views_admin_read" ON video_views;
CREATE POLICY "video_views_admin_read" ON video_views FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.is_admin = true)
  );

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call handle_new_user on user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for profiles
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for videos
DROP TRIGGER IF EXISTS update_videos_updated_at ON videos;
CREATE TRIGGER update_videos_updated_at
  BEFORE UPDATE ON videos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to increment video views
CREATE OR REPLACE FUNCTION public.increment_video_views(video_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE videos SET views_count = views_count + 1 WHERE id = video_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert default categories
INSERT INTO categories (name, slug, description, icon_name) VALUES
  ('Action', 'action', 'High-octane thrills and adventure', 'Sword'),
  ('Comedy', 'comedy', 'Laugh-out-loud entertainment', 'Smile'),
  ('Drama', 'drama', 'Compelling stories and characters', 'Theatre'),
  ('Horror', 'horror', 'Scream-worthy scares', 'Ghost'),
  ('Sci-Fi', 'sci-fi', 'Science fiction and fantasy', 'Rocket'),
  ('Romance', 'romance', 'Love stories and relationships', 'Heart'),
  ('Documentary', 'documentary', 'Real stories and facts', 'File-text'),
  ('Thriller', 'thriller', 'Edge-of-your-seat suspense', 'Eye'),
  ('Animation', 'animation', 'Animated features for all ages', 'Sparkles'),
  ('Family', 'family', 'Fun for the whole family', 'Users')
ON CONFLICT (slug) DO NOTHING;