import { supabase } from './supabase';
import type { VideoSchedule, Video } from './supabase';

export async function scheduleVideo(
  videoId: string,
  creatorId: string,
  scheduledAt: string,
  premiere: boolean = false
): Promise<VideoSchedule> {
  const { data: existing } = await supabase
    .from('video_schedules')
    .select('id')
    .eq('video_id', videoId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from('video_schedules')
      .update({ scheduled_at: scheduledAt, premiere, published: false })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as VideoSchedule;
  }

  const { data, error } = await supabase
    .from('video_schedules')
    .insert({
      video_id: videoId,
      creator_id: creatorId,
      scheduled_at: scheduledAt,
      premiere,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('videos')
    .update({
      scheduled_at: scheduledAt,
      premiere_at: premiere ? scheduledAt : null,
      status: 'draft',
    })
    .eq('id', videoId);

  return data as VideoSchedule;
}

export async function unscheduleVideo(videoId: string): Promise<void> {
  const { error } = await supabase
    .from('video_schedules')
    .delete()
    .eq('video_id', videoId);
  if (error) throw error;

  await supabase
    .from('videos')
    .update({ scheduled_at: null, premiere_at: null })
    .eq('id', videoId);
}

export async function getVideoSchedule(videoId: string): Promise<VideoSchedule | null> {
  const { data, error } = await supabase
    .from('video_schedules')
    .select('*')
    .eq('video_id', videoId)
    .maybeSingle();
  if (error) throw error;
  return data as VideoSchedule | null;
}

export async function getCreatorSchedules(creatorId: string): Promise<(VideoSchedule & { video?: Video })[]> {
  const { data, error } = await supabase
    .from('video_schedules')
    .select(`
      *,
      video:videos!video_schedules_video_id_fkey(*)
    `)
    .eq('creator_id', creatorId)
    .eq('published', false)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data || []) as (VideoSchedule & { video?: Video })[];
}

export async function publishScheduledVideos(): Promise<number> {
  const { data, error } = await supabase.rpc('publish_scheduled_videos');
  if (error) return 0;
  return data || 0;
}

export async function publishNow(videoId: string): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({ status: 'published', scheduled_at: null, premiere_at: null, updated_at: new Date().toISOString() })
    .eq('id', videoId);
  if (error) throw error;

  await supabase
    .from('video_schedules')
    .update({ published: true })
    .eq('video_id', videoId);
}

export function formatCountdown(scheduledAt: string): string {
  const now = Date.now();
  const target = new Date(scheduledAt).getTime();
  const diff = target - now;
  if (diff <= 0) return 'Starting soon';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export function formatScheduledDate(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}
