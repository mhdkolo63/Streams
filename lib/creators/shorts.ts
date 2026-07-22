/**
 * Shorts service — helpers for identifying, fetching, and discovering short-form videos.
 */

import { supabase, Video } from '@/lib/supabase';

export function isShort(video: Video): boolean {
  return video.is_short === true || video.aspect_ratio === '9:16' || (video.duration > 0 && video.duration <= 60);
}

export async function getShorts(limit = 20, excludeIds: string[] = []): Promise<Video[]> {
  let query = supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .eq('is_short', true)
    .order('views_count', { ascending: false })
    .limit(limit * 3);

  if (excludeIds.length > 0) {
    query = query.not('id', 'in', `(${excludeIds.join(',')})`);
  }

  const { data, error } = await query;
  if (error || !data) {
    // Fallback to client-side filter if is_short column not available
    const { data: fallback } = await supabase
      .from('videos')
      .select('*')
      .eq('status', 'published')
      .order('views_count', { ascending: false })
      .limit(limit * 3);
    if (!fallback) return [];
    const shorts = (fallback as Video[]).filter((v) => isShort(v) && !excludeIds.includes(v.id));
    return shorts.slice(0, limit);
  }

  return (data as Video[]).slice(0, limit);
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

export interface ShortsFeedResult {
  videos: Video[];
  reason: string;
}

export async function getShortsFeed(
  userId?: string,
  limit = 20,
  excludeIds: string[] = []
): Promise<ShortsFeedResult> {
  const excludeSet = new Set(excludeIds);

  // If user is logged in, try to get personalized feed
  if (userId) {
    // 1. Get shorts from subscribed creators
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('channel_id')
      .eq('subscriber_id', userId);

    if (subs && subs.length > 0) {
      const channelIds = subs.map((s: any) => s.channel_id);
      const { data: subShorts } = await supabase
        .from('videos')
        .select('*')
        .in('uploader_id', channelIds)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(limit * 2);

      if (subShorts) {
        const filtered = (subShorts as Video[]).filter(
          (v) => isShort(v) && !excludeSet.has(v.id)
        );
        if (filtered.length >= limit) {
          return { videos: filtered.slice(0, limit), reason: 'From your subscriptions' };
        }
      }
    }

    // 2. Get shorts from liked video creators
    const { data: likes } = await supabase
      .from('video_likes')
      .select('video_id, videos!inner(uploader_id)')
      .eq('user_id', userId)
      .limit(50);

    if (likes && likes.length > 0) {
      const likedCreatorIds = [...new Set(
        likes.map((l: any) => l.videos?.uploader_id).filter(Boolean)
      )];
      if (likedCreatorIds.length > 0) {
        const { data: creatorShorts } = await supabase
          .from('videos')
          .select('*')
          .in('uploader_id', likedCreatorIds)
          .eq('status', 'published')
          .order('created_at', { ascending: false })
          .limit(limit * 2);

        if (creatorShorts) {
          const filtered = (creatorShorts as Video[]).filter(
            (v) => isShort(v) && !excludeSet.has(v.id)
          );
          if (filtered.length > 0) {
            return { videos: filtered.slice(0, limit), reason: 'From creators you like' };
          }
        }
      }
    }
  }

  // 3. Fallback: trending shorts
  const { data: trending } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .eq('trending', true)
    .order('views_count', { ascending: false })
    .limit(limit * 3);

  if (trending) {
    const filtered = (trending as Video[]).filter(
      (v) => isShort(v) && !excludeSet.has(v.id)
    );
    if (filtered.length >= limit) {
      return { videos: filtered.slice(0, limit), reason: 'Trending shorts' };
    }
  }

  // 4. Fallback: most viewed shorts
  const { data: popular } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .order('views_count', { ascending: false })
    .limit(limit * 3);

  if (popular) {
    const filtered = (popular as Video[]).filter(
      (v) => isShort(v) && !excludeSet.has(v.id)
    );
    return { videos: filtered.slice(0, limit), reason: 'Popular shorts' };
  }

  return { videos: [], reason: 'No shorts available' };
}

export async function searchShorts(
  query: string,
  limit = 20
): Promise<Video[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('status', 'published')
    .or(`title.ilike.%${q}%,tags.cs.{${q}}`)
    .order('views_count', { ascending: false })
    .limit(limit * 3);

  if (error || !data) return [];
  return (data as Video[]).filter(isShort).slice(0, limit);
}
