/**
 * Comments service — placeholder for the video comments system.
 *
 * Phase 1 prepares the architecture; the `comments` table and RLS policies
 * will be added in a later phase.
 */

import { supabase } from '@/lib/supabase';

export interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  body: string;
  created_at: string;
}

export async function getComments(videoId: string): Promise<Comment[]> {
  // TODO: implement once comments table exists
  return [];
}

export async function addComment(videoId: string, body: string): Promise<Comment | null> {
  // TODO: implement once comments table exists
  return null;
}

export async function deleteComment(commentId: string): Promise<boolean> {
  // TODO: implement once comments table exists
  return false;
}
