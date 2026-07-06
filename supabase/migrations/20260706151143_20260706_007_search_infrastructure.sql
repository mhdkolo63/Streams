-- Add indexes for search performance

-- Index on status for filtering published videos
CREATE INDEX IF NOT EXISTS videos_status_idx ON videos (status);

-- Index on created_at for sorting by newest
CREATE INDEX IF NOT EXISTS videos_created_at_idx ON videos (created_at DESC);

-- Index on views_count for sorting by most watched
CREATE INDEX IF NOT EXISTS videos_views_count_idx ON videos (views_count DESC);

-- Index on genre for filtering
CREATE INDEX IF NOT EXISTS videos_genre_idx ON videos (genre);

-- Index on language for filtering
CREATE INDEX IF NOT EXISTS videos_language_idx ON videos (language);

-- Index on release_year for filtering
CREATE INDEX IF NOT EXISTS videos_release_year_idx ON videos (release_year);

-- Index on title for ILIKE searches
CREATE INDEX IF NOT EXISTS videos_title_idx ON videos (title);

-- Trending searches tracking table
CREATE TABLE IF NOT EXISTS search_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  searched_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE search_logs ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a search log
CREATE POLICY "insert_search_logs" ON search_logs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Anyone can read aggregate search data (for trending searches)
CREATE POLICY "select_search_logs" ON search_logs
  FOR SELECT TO anon, authenticated USING (true);

-- Index for trending search aggregation
CREATE INDEX IF NOT EXISTS search_logs_searched_at_idx ON search_logs (searched_at DESC);
CREATE INDEX IF NOT EXISTS search_logs_search_term_idx ON search_logs (search_term);
