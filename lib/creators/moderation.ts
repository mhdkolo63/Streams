/**
 * Moderation service — placeholder for content moderation tooling.
 *
 * Phase 1 prepares the architecture; reporting and moderation queues will be
 * added in a later phase.
 */

import { supabase } from '@/lib/supabase';

export interface Report {
  id: string;
  reporter_id: string;
  video_id: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved';
  created_at: string;
}

export async function reportVideo(videoId: string, reason: string): Promise<boolean> {
  // TODO: implement once reports table exists
  return false;
}

export async function getPendingReports(): Promise<Report[]> {
  // TODO: implement once reports table exists
  return [];
}
