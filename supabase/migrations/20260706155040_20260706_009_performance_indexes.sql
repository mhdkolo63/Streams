-- Composite index for video_categories: fast category lookup with filter
CREATE INDEX IF NOT EXISTS idx_video_categories_category_status
  ON video_categories (category_id)
  INCLUDE (video_id);

-- Composite index: videos by status + views (for trending/most-watched queries)
CREATE INDEX IF NOT EXISTS idx_videos_status_views
  ON videos (status, views_count DESC)
  WHERE status = 'published';

-- Composite index: videos by status + created_at (for recent queries)
CREATE INDEX IF NOT EXISTS idx_videos_status_created
  ON videos (status, created_at DESC)
  WHERE status = 'published';

-- Composite index: videos by status + featured (for homepage featured queries)
CREATE INDEX IF NOT EXISTS idx_videos_status_featured
  ON videos (status, featured)
  WHERE status = 'published' AND featured = true;

-- Composite index: videos by status + trending
CREATE INDEX IF NOT EXISTS idx_videos_status_trending
  ON videos (status, trending)
  WHERE status = 'published' AND trending = true;

-- Watch history: composite for per-user lookups sorted by recency
CREATE INDEX IF NOT EXISTS idx_watch_history_user_watched
  ON watch_history (user_id, last_watched_at DESC);

-- Watch history: composite for continue-watching (incomplete videos)
CREATE INDEX IF NOT EXISTS idx_watch_history_user_incomplete
  ON watch_history (user_id, last_watched_at DESC)
  WHERE completed = false;

-- Video views: composite for per-video dedup check
CREATE INDEX IF NOT EXISTS idx_video_views_video_user
  ON video_views (video_id, user_id);

-- Video views: composite for per-user timeline
CREATE INDEX IF NOT EXISTS idx_video_views_user_viewed
  ON video_views (user_id, viewed_at DESC);

-- Notifications: composite for per-user unread + recent
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_recent
  ON notifications (user_id, is_read, created_at DESC);

-- Video title full-text search: trigram index for ILIKE queries
-- Only create if pg_trgm is available
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_videos_title_trgm ON videos USING gin (title gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_videos_description_trgm ON videos USING gin (description gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_videos_genre_trgm ON videos USING gin (genre gin_trgm_ops)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_videos_director_trgm ON videos USING gin (director gin_trgm_ops)';
  END IF;
END $$;
