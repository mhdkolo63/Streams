import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === 'web' ? localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type { User } from '@supabase/supabase-js';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  username: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  video_id: string;
  type: string;
  title: string | null;
  body: string | null;
  thumbnail_url: string | null;
  is_read: boolean;
  created_at: string;
}

export interface VideoLike {
  id: string;
  user_id: string;
  video_id: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_name: string | null;
  image_url: string | null;
  sort_order: number;
  created_at: string;
}

export interface Video {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  trailer_url: string | null;
  duration: number;
  release_year: number | null;
  genre: string | null;
  rating: string | null;
  video_cast: string[] | null;
  director: string | null;
  producer: string | null;
  language: string | null;
  tags: string[] | null;
  resolution: string | null;
  aspect_ratio: string | null;
  featured: boolean;
  trending: boolean;
  views_count: number;
  like_count: number;
  uploader_id: string | null;
  status: 'draft' | 'published' | 'unpublished' | 'private';
  created_at: string;
  updated_at: string;
  categories?: Category[];
}

export interface WatchHistory {
  id: string;
  user_id: string;
  video_id: string;
  progress: number;
  completed: boolean;
  last_watched_at: string;
  video?: Video;
}

export interface Favorite {
  id: string;
  user_id: string;
  video_id: string;
  created_at: string;
  video?: Video;
}

export interface VideoView {
  id: string;
  video_id: string;
  user_id: string | null;
  viewed_at: string;
  watch_duration: number;
  ip_address: string | null;
  user_agent: string | null;
  country: string | null;
}
