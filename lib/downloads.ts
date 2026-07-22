import { supabase } from './supabase';
import type { Download, Video } from './supabase';

export const DOWNLOAD_QUALITIES = [
  { label: 'Auto', value: 'auto' },
  { label: '144p', value: '144' },
  { label: '240p', value: '240' },
  { label: '360p', value: '360' },
  { label: '480p', value: '480' },
  { label: '720p', value: '720' },
  { label: '1080p', value: '1080' },
  { label: '2K', value: '1440' },
  { label: '4K', value: '2160' },
] as const;

export async function getUserDownloads(userId: string): Promise<(Download & { video?: Video })[]> {
  const { data, error } = await supabase
    .from('downloads')
    .select(`
      *,
      video:videos!downloads_video_id_fkey(*)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as (Download & { video?: Video })[];
}

export async function createDownload(
  userId: string,
  videoId: string,
  quality: string = 'auto'
): Promise<Download> {
  const { data, error } = await supabase
    .from('downloads')
    .insert({
      user_id: userId,
      video_id: videoId,
      quality,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  await supabase.rpc('increment_download_count', { p_video_id: videoId }).then(() => {});
  return data as Download;
}

export async function updateDownloadStatus(
  downloadId: string,
  status: Download['status'],
  fileSize?: number,
  storagePath?: string
): Promise<void> {
  const updates: Record<string, unknown> = { status };
  if (fileSize !== undefined) updates.file_size = fileSize;
  if (storagePath !== undefined) updates.storage_path = storagePath;
  if (status === 'completed') updates.downloaded_at = new Date().toISOString();
  const { error } = await supabase
    .from('downloads')
    .update(updates)
    .eq('id', downloadId);
  if (error) throw error;
}

export async function removeDownload(downloadId: string): Promise<void> {
  const { error } = await supabase
    .from('downloads')
    .delete()
    .eq('id', downloadId);
  if (error) throw error;
}

export async function removeAllDownloads(userId: string): Promise<void> {
  const { error } = await supabase
    .from('downloads')
    .delete()
    .eq('user_id', userId);
  if (error) throw error;
}

export async function checkDownloadExists(userId: string, videoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('downloads')
    .select('id')
    .eq('user_id', userId)
    .eq('video_id', videoId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function getDownloadStorageUsage(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('downloads')
    .select('file_size')
    .eq('user_id', userId)
    .eq('status', 'completed');
  if (error || !data) return 0;
  return data.reduce((sum: number, d: { file_size: number }) => sum + (d.file_size || 0), 0);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function downloadVideoFile(videoUrl: string, filename: string): void {
  if (typeof window !== 'undefined') {
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
