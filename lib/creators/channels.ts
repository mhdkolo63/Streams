/**
 * Channel service — fetches and transforms creator channel data.
 *
 * Every StreamWorld user has an implicit channel derived from their `profiles`
 * row. This module provides helpers for fetching channel stats, banners, and
 * the videos belonging to a creator.
 */

import { supabase, Profile, Video } from '@/lib/supabase';

export interface ChannelStats {
  videoCount: number;
  totalViews: number;
  totalLikes: number;
  subscribers: number;
}

export interface ChannelData {
  profile: Profile;
  stats: ChannelStats;
  videos: Video[];
}

export async function getChannel(userId: string): Promise<ChannelData | null> {
  const [profileRes, videosRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    supabase
      .from('videos')
      .select('*')
      .eq('uploader_id', userId)
      .eq('status', 'published')
      .order('created_at', { ascending: false }),
  ]);

  if (profileRes.error || videosRes.error) return null;
  if (!profileRes.data) return null;

  const videos = (videosRes.data as Video[]) || [];
  const videoIds = videos.map((v) => v.id);

  let totalViews = videos.reduce((sum, v) => sum + (v.views_count || 0), 0);
  let totalLikes = 0;

  if (videoIds.length > 0) {
    const [viewsRes, likesRes] = await Promise.all([
      supabase
        .from('video_views')
        .select('id', { count: 'exact', head: true })
        .in('video_id', videoIds),
      supabase
        .from('video_likes')
        .select('id', { count: 'exact', head: true })
        .in('video_id', videoIds),
    ]);
    if (viewsRes.count !== null) totalViews = viewsRes.count;
    if (likesRes.count !== null) totalLikes = likesRes.count;
  }

  return {
    profile: profileRes.data as Profile,
    stats: { videoCount: videos.length, totalViews, totalLikes, subscribers: 0 },
    videos,
  };
}

export async function updateChannelBanner(userId: string, bannerUrl: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ banner_url: bannerUrl })
    .eq('id', userId);
  return !error;
}

export async function updateChannelBio(userId: string, bio: string | null): Promise<boolean> {
  const { error } = await supabase
    .from('profiles')
    .update({ bio })
    .eq('id', userId);
  return !error;
}
