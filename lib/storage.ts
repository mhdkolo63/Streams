/**
 * Storage upload helpers with real progress tracking and retry logic.
 * Uses XHR for upload progress support (Supabase JS client doesn't expose progress).
 */

import { supabase } from './supabase';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const VIDEO_MIME_MAP: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
  avi: 'video/avi',
};

const IMAGE_MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export function getVideoMime(ext: string): string {
  return VIDEO_MIME_MAP[ext.toLowerCase()] || 'video/mp4';
}

export function getImageMime(ext: string): string {
  return IMAGE_MIME_MAP[ext.toLowerCase()] || 'image/jpeg';
}

export interface UploadResult {
  path: string;
  publicUrl: string;
}

export async function uploadWithProgress(
  bucket: string,
  filePath: string,
  blob: Blob,
  contentType: string,
  onProgress: (progress: number) => void,
  upsert: boolean = false,
  maxRetries: number = 3
): Promise<UploadResult> {
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token || SUPABASE_ANON_KEY;

  const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${filePath}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await uploadOnce(url, blob, contentType, accessToken, onProgress, upsert);
      const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return { path: filePath, publicUrl: urlData.publicUrl };
    } catch (err: any) {
      lastError = err;
      const msg = (err.message || '').toLowerCase();
      if (
        msg.includes('permission') ||
        msg.includes('unauthorized') ||
        msg.includes('forbidden') ||
        msg.includes('duplicate') ||
        msg.includes('already exists') ||
        msg.includes('mime') ||
        msg.includes('409') ||
        msg.includes('403') ||
        msg.includes('401')
      ) {
        throw err;
      }
      if (attempt < maxRetries - 1) {
        onProgress(0);
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  throw lastError || new Error('Upload failed');
}

function uploadOnce(
  url: string,
  blob: Blob,
  contentType: string,
  accessToken: string,
  onProgress: (progress: number) => void,
  upsert: boolean
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${accessToken}`);
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY);
    xhr.setRequestHeader('Content-Type', contentType);
    if (upsert) xhr.setRequestHeader('x-upsert', 'true');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let msg = `Upload failed (HTTP ${xhr.status})`;
        try {
          const err = JSON.parse(xhr.responseText);
          msg = err.message || err.error || err.msg || msg;
        } catch {
          if (xhr.status === 403) msg = 'Permission denied. You may not have access to upload to this bucket.';
          else if (xhr.status === 409) msg = 'A file with this name already exists.';
        }
        reject(new Error(msg));
      }
    };

    xhr.onerror = () =>
      reject(new Error('Network error during upload. Please check your connection.'));
    xhr.ontimeout = () =>
      reject(new Error('Upload timed out. Please try again.'));
    xhr.timeout = 600000;

    xhr.send(blob);
  });
}
