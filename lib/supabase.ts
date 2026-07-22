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
  bio: string | null;
  banner_url: string | null;
  is_admin: boolean;
  is_premium: boolean;
  is_eligible_creator: boolean;
  monetization_approved: boolean;
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
  status: 'draft' | 'published' | 'unlisted' | 'private';
  is_premium: boolean;
  is_member_only: boolean;
  premiere_at: string | null;
  scheduled_at: string | null;
  download_count: number;
  is_short: boolean;
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

export interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  profiles?: Profile;
  replies?: Comment[];
  liked_by_me?: boolean;
}

export interface Subscription {
  id: string;
  subscriber_id: string;
  channel_id: string;
  created_at: string;
}

export interface LiveStream {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  stream_url: string | null;
  stream_key: string;
  status: 'scheduled' | 'live' | 'ended' | 'cancelled';
  is_premium: boolean;
  is_member_only: boolean;
  scheduled_start: string | null;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number;
  peak_viewers: number;
  chat_enabled: boolean;
  slow_mode: boolean;
  slow_mode_interval: number;
  subscriber_only_chat: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  creator_name?: string;
  creator_avatar?: string | null;
  subscriber_count?: number;
}

export interface LiveChatMessage {
  id: string;
  stream_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  is_pinned: boolean;
  is_deleted: boolean;
  is_moderator: boolean;
  is_super_chat: boolean;
  super_chat_amount: number;
  created_at: string;
  profiles?: Profile;
}

export interface VideoSchedule {
  id: string;
  video_id: string;
  creator_id: string;
  premiere: boolean;
  scheduled_at: string;
  countdown_started: boolean;
  published: boolean;
  created_at: string;
}

export interface Download {
  id: string;
  user_id: string;
  video_id: string;
  quality: string;
  file_size: number;
  status: 'pending' | 'downloading' | 'completed' | 'failed' | 'expired';
  storage_path: string | null;
  downloaded_at: string | null;
  expires_at: string | null;
  created_at: string;
  video?: Video;
}

export interface ChannelMembership {
  id: string;
  channel_id: string;
  user_id: string;
  tier: string;
  is_active: boolean;
  joined_at: string;
}

export interface Donation {
  id: string;
  sender_id: string;
  receiver_id: string;
  video_id: string | null;
  stream_id: string | null;
  amount: number;
  currency: string;
  type: 'super_thanks' | 'super_chat' | 'tip';
  message: string | null;
  created_at: string;
}

export interface PlatformSettings {
  id: number;
  live_streaming_enabled: boolean;
  monetization_enabled: boolean;
  premium_videos_enabled: boolean;
  premium_content_enabled: boolean;
  memberships_enabled: boolean;
  donations_enabled: boolean;
  downloads_enabled: boolean;
  watch_party_enabled: boolean;
  updated_at: string;
}

export interface WatchParty {
  id: string;
  host_id: string;
  video_id: string;
  status: 'waiting' | 'active' | 'ended';
  created_at: string;
  started_at: string | null;
  ended_at: string | null;
}
