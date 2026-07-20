/*
# StreamWorld Phase 1: Add creator profile fields

1. Modified Tables
- `profiles`
  - Add `bio` (text, nullable) — creator biography shown on channel page
  - Add `banner_url` (text, nullable) — channel banner image URL

2. Security
- No RLS policy changes needed; existing `update_own_profiles_safe` policy
  already covers the new columns since it allows updating all non-protected
  columns for the owning user.

3. Notes
- Both columns are nullable so existing profile rows remain valid.
- `bio` and `banner_url` are plain text URLs (no storage bucket changes).
*/

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS banner_url text;
