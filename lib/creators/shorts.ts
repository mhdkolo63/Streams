/**
 * Shorts service — helpers for identifying and fetching short-form videos.
 *
 * Shorts are vertical videos (aspect_ratio 9:16) with a duration of 60 seconds
 * or less. They are stored in the existing `videos` table and filtered by these
 * criteria.
 */

import { supabase, Video } from '@/lib/supabase';

export function isShort(video: Video): boolean {
  return video.aspect_ratio === '9:16' || (video.duration > 0 && video.duration <= 60);
}

export async function getShorts(limit = 20): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .order('views_count', { ascending: false })
    .limit(limit * 2);

  if (error || !data) return [];

  const all = data as Video[];
  const shorts = all.filter(isShort);
  return shorts.length > 0 ? shorts.slice(0, limit) : all.slice(0, limit);
}

export async function getShortsByCreator(userId: string, limit = 20): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('uploader_id', userId)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return (data as Video[]).filter(isShort);
}
