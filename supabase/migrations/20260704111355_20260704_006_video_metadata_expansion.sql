/*
# Expand Video Metadata for Professional Media Management

## Purpose
Adds missing metadata fields to the `videos` table to support a YouTube Studio-like
upload and management experience. Also adds 'private' as a valid visibility status.

## Changes to `videos` table
1. `language` (text, nullable) — spoken language of the video (e.g., English, Spanish)
2. `producer` (text, nullable) — producer name
3. `tags` (text[], nullable) — array of tag strings for search/discovery
4. `resolution` (text, nullable) — detected resolution (e.g., "1920x1080")
5. `aspect_ratio` (text, nullable) — detected aspect ratio (e.g., "16:9", "9:16")

## Status constraint update
6. Updates the `status` CHECK constraint to include 'private' alongside
   'draft', 'published', and 'unpublished'.

## Security
- No RLS policy changes — existing policies remain in effect.
- No new tables created.

## Notes
1. All new columns are nullable so existing rows are unaffected.
2. The migration is idempotent — uses DO $$ ... IF NOT EXISTS ... END $$ blocks.
3. The status constraint is dropped and recreated to safely add 'private'.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'language'
  ) THEN
    ALTER TABLE videos ADD COLUMN language text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'producer'
  ) THEN
    ALTER TABLE videos ADD COLUMN producer text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'tags'
  ) THEN
    ALTER TABLE videos ADD COLUMN tags text[];
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'resolution'
  ) THEN
    ALTER TABLE videos ADD COLUMN resolution text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'videos' AND column_name = 'aspect_ratio'
  ) THEN
    ALTER TABLE videos ADD COLUMN aspect_ratio text;
  END IF;
END $$;

-- Update status constraint to include 'private'
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'videos_status_check' AND table_name = 'videos'
  ) THEN
    ALTER TABLE videos DROP CONSTRAINT videos_status_check;
  END IF;
END $$;

ALTER TABLE videos ADD CONSTRAINT videos_status_check
  CHECK (status IN ('draft', 'published', 'unpublished', 'private'));
