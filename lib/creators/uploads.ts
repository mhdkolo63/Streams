/**
 * Uploads service — helpers for the creator upload flow.
 *
 * The actual upload UI lives in the admin panel (`/admin/upload`). This module
 * exposes helpers used to validate and persist video metadata.
 */

import { supabase, Video } from '@/lib/supabase';
import { VALIDATION, sanitizeString, sanitizeFilename } from '@/lib/validation';

export interface UploadPayload {
  title: string;
  description?: string;
  video_url: string;
  thumbnail_url?: string;
  duration: number;
  genre?: string;
  language?: string;
  tags?: string[];
  aspect_ratio?: string;
  resolution?: string;
}

export function validateUpload(payload: UploadPayload): { valid: boolean; message?: string } {
  if (!payload.title || payload.title.trim().length === 0) {
    return { valid: false, message: 'Title is required' };
  }
  if (payload.title.length > 120) {
    return { valid: false, message: 'Title must be 120 characters or less' };
  }
  if (!payload.video_url) {
    return { valid: false, message: 'Video file is required' };
  }
  if (payload.duration <= 0) {
    return { valid: false, message: 'Duration must be greater than zero' };
  }
  return { valid: true };
}

export async function publishVideo(userId: string, payload: UploadPayload): Promise<Video | null> {
  const check = validateUpload(payload);
  if (!check.valid) return null;

  const { data, error } = await supabase
    .from('videos')
    .insert({
      title: sanitizeString(payload.title, 120),
      description: payload.description ? sanitizeString(payload.description, 2000) : null,
      video_url: payload.video_url,
      thumbnail_url: payload.thumbnail_url || null,
      duration: payload.duration,
      genre: payload.genre || null,
      language: payload.language || null,
      tags: payload.tags || null,
      aspect_ratio: payload.aspect_ratio || '16:9',
      is_short: (payload.duration > 0 && payload.duration <= 60) || payload.aspect_ratio === '9:16',
      resolution: payload.resolution || null,
      uploader_id: userId,
      status: 'published',
      views_count: 0,
    })
    .select('*')
    .maybeSingle();

  if (error || !data) return null;
  return data as Video;
}
