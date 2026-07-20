/**
 * Playlists service — placeholder for user-curated playlists.
 *
 * Phase 1 prepares the architecture; the `playlists` and `playlist_items`
 * tables will be added in a later phase.
 */

import { supabase, Video } from '@/lib/supabase';

export interface Playlist {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  video_id: string;
  position: number;
  added_at: string;
}

export async function getPlaylists(userId: string): Promise<Playlist[]> {
  // TODO: implement once playlists table exists
  return [];
}

export async function createPlaylist(title: string, description?: string): Promise<Playlist | null> {
  // TODO: implement once playlists table exists
  return null;
}

export async function addToPlaylist(playlistId: string, videoId: string): Promise<boolean> {
  // TODO: implement once playlist_items table exists
  return false;
}

export async function removeFromPlaylist(playlistId: string, videoId: string): Promise<boolean> {
  // TODO: implement once playlist_items table exists
  return false;
}
