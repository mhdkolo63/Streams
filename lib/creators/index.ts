/**
 * Creator Studio services — real implementations for the creator platform.
 *
 * Re-exports channel/shorts helpers plus dashboard analytics, content
 * management, and storage usage.
 */

export * from './channels';
export * from './shorts';
export * from './subscriptions';
export * from './comments';
export * from './playlists';
export * from './moderation';
export * from './uploads';

import { supabase, Video } from '@/lib/supabase';

export interface CreatorDashboardStats {
  totalVideos: number;
  totalShorts: number;
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  subscribers: number;
  watchTime: number;
  totalUploads: number;
}

export interface CreatorActivity {
  id: string;
  type: 'upload' | 'short' | 'subscriber' | 'comment' | 'like';
  message: string;
  created_at: string;
}

export async function getCreatorStats(userId: string): Promise<CreatorDashboardStats> {
  const { data: videos } = await supabase
    .from('videos')
    .select('id, duration, views_count, aspect_ratio, status')
    .eq('uploader_id', userId);

  const allVideos = (videos as Video[]) || [];
  const shorts = allVideos.filter(
    (v) => v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60)
  );
  const videoIds = allVideos.map((v) => v.id);

  let totalViews = allVideos.reduce((sum, v) => sum + (v.views_count || 0), 0);
  let totalLikes = 0;
  let watchTime = 0;

  if (videoIds.length > 0) {
    const [viewsRes, likesRes] = await Promise.all([
      supabase
        .from('video_views')
        .select('id, video_id', { count: 'exact', head: false })
        .in('video_id', videoIds)
        .limit(500),
      supabase
        .from('video_likes')
        .select('id', { count: 'exact', head: true })
        .in('video_id', videoIds),
    ]);

    if (viewsRes.count !== null) totalViews = viewsRes.count;
    if (likesRes.count !== null) totalLikes = likesRes.count;

    // Estimate watch time from views
    if (viewsRes.data) {
      const viewCounts = new Map<string, number>();
      viewsRes.data.forEach((v: any) => {
        viewCounts.set(v.video_id, (viewCounts.get(v.video_id) || 0) + 1);
      });
      allVideos.forEach((v) => {
        watchTime += (viewCounts.get(v.id) || 0) * (v.duration || 0);
      });
    }
  }

  return {
    totalVideos: allVideos.length - shorts.length,
    totalShorts: shorts.length,
    totalViews,
    totalLikes,
    totalComments: 0,
    subscribers: 0,
    watchTime,
    totalUploads: allVideos.length,
  };
}

export async function getCreatorActivity(userId: string, limit = 10): Promise<CreatorActivity[]> {
  const { data: videos } = await supabase
    .from('videos')
    .select('id, title, created_at, aspect_ratio, duration')
    .eq('uploader_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  const activities: CreatorActivity[] = [];

  if (videos) {
    videos.forEach((v: any) => {
      const isShort = v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60);
      activities.push({
        id: `upload_${v.id}`,
        type: isShort ? 'short' : 'upload',
        message: isShort ? `Short "${v.title}" uploaded` : `Video "${v.title}" uploaded`,
        created_at: v.created_at,
      });
    });
  }

  // Get recent likes on creator's videos
  const videoIds = (videos || []).map((v: any) => v.id);
  if (videoIds.length > 0) {
    const { data: likes } = await supabase
      .from('video_likes')
      .select('video_id, created_at, videos(title)')
      .in('video_id', videoIds)
      .order('created_at', { ascending: false })
      .limit(5);

    if (likes) {
      likes.forEach((l: any) => {
        activities.push({
          id: `like_${l.video_id}_${l.created_at}`,
          type: 'like',
          message: `New like on "${l.videos?.title || 'your video'}"`,
          created_at: l.created_at,
        });
      });
    }
  }

  activities.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return activities.slice(0, limit);
}

export async function getCreatorVideos(userId: string): Promise<Video[]> {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('uploader_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Video[];
}

export async function deleteCreatorVideo(videoId: string, userId: string): Promise<boolean> {
  // Fetch the video to get file paths and verify ownership
  const { data: video } = await supabase
    .from('videos')
    .select('id, uploader_id, video_url, thumbnail_url')
    .eq('id', videoId)
    .maybeSingle();

  if (!video || video.uploader_id !== userId) return false;

  // Delete video file from storage
  if (video.video_url) {
    const videoPath = extractStoragePath(video.video_url, 'videos');
    if (videoPath) {
      await supabase.storage.from('videos').remove([videoPath]);
    }
  }

  // Delete thumbnail from storage
  if (video.thumbnail_url) {
    const thumbPath = extractStoragePath(video.thumbnail_url, 'thumbnails');
    if (thumbPath) {
      await supabase.storage.from('thumbnails').remove([thumbPath]);
    }
  }

  // Delete category links
  await supabase.from('video_categories').delete().eq('video_id', videoId);

  // Delete the video record
  const { error } = await supabase.from('videos').delete().eq('id', videoId).eq('uploader_id', userId);
  return !error;
}

export async function updateCreatorVideo(
  videoId: string,
  userId: string,
  updates: Partial<Video>
): Promise<boolean> {
  const { error } = await supabase
    .from('videos')
    .update(updates)
    .eq('id', videoId)
    .eq('uploader_id', userId);
  return !error;
}

export interface StorageUsage {
  usedBytes: number;
  fileCount: number;
  videoCount: number;
}

export async function getStorageUsage(userId: string): Promise<StorageUsage> {
  const { data: videos } = await supabase
    .from('videos')
    .select('id, video_url, thumbnail_url')
    .eq('uploader_id', userId);

  const allVideos = (videos as any[]) || [];
  let usedBytes = 0;
  let fileCount = 0;

  // List files in user's folder in videos bucket
  const { data: videoFiles } = await supabase.storage
    .from('videos')
    .list(userId, { limit: 100 });

  if (videoFiles) {
    videoFiles.forEach((f) => {
      usedBytes += f.metadata?.size || 0;
      fileCount++;
    });
  }

  // List files in user's folder in thumbnails bucket
  const { data: thumbFiles } = await supabase.storage
    .from('thumbnails')
    .list(userId, { limit: 100 });

  if (thumbFiles) {
    thumbFiles.forEach((f) => {
      usedBytes += f.metadata?.size || 0;
      fileCount++;
    });
  }

  return {
    usedBytes,
    fileCount,
    videoCount: allVideos.length,
  };
}

function extractStoragePath(url: string, bucket: string): string | null {
  try {
    const parts = url.split(`/${bucket}/`);
    if (parts.length < 2) return null;
    return parts[1].split('?')[0];
  } catch {
    return null;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return bytes + ' B';
}

export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}
