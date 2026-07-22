import { supabase } from './supabase';
import type { PlatformSettings, Donation, ChannelMembership } from './supabase';

export async function getPlatformSettings(): Promise<PlatformSettings | null> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data as PlatformSettings | null;
}

export async function updatePlatformSettings(updates: Partial<PlatformSettings>): Promise<void> {
  const { error } = await supabase
    .from('platform_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1);
  if (error) throw error;
}

export async function setVideoPremium(videoId: string, isPremium: boolean): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({ is_premium: isPremium })
    .eq('id', videoId);
  if (error) throw error;
}

export async function setVideoMemberOnly(videoId: string, isMemberOnly: boolean): Promise<void> {
  const { error } = await supabase
    .from('videos')
    .update({ is_member_only: isMemberOnly })
    .eq('id', videoId);
  if (error) throw error;
}

export async function approveCreatorMonetization(userId: string, approved: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ monetization_approved: approved })
    .eq('id', userId);
  if (error) throw error;
}

export async function setCreatorEligibility(userId: string, eligible: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_eligible_creator: eligible })
    .eq('id', userId);
  if (error) throw error;
}

export async function setUserPremium(userId: string, isPremium: boolean): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_premium: isPremium })
    .eq('id', userId);
  if (error) throw error;
}

export async function joinChannel(channelId: string, userId: string, tier: string = 'basic'): Promise<ChannelMembership> {
  const { data, error } = await supabase
    .from('channel_memberships')
    .insert({
      channel_id: channelId,
      user_id: userId,
      tier,
      is_active: true,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChannelMembership;
}

export async function leaveChannel(channelId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('channel_memberships')
    .delete()
    .eq('channel_id', channelId)
    .eq('user_id', userId);
  if (error) throw error;
}

export async function checkMembership(channelId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('channel_memberships')
    .select('id')
    .eq('channel_id', channelId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  if (error) return false;
  return !!data;
}

export async function getChannelMembers(channelId: string): Promise<ChannelMembership[]> {
  const { data, error } = await supabase
    .from('channel_memberships')
    .select('*')
    .eq('channel_id', channelId)
    .eq('is_active', true)
    .order('joined_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ChannelMembership[];
}

export async function createDonation(
  senderId: string,
  receiverId: string,
  amount: number,
  type: Donation['type'],
  message: string = '',
  videoId?: string,
  streamId?: string
): Promise<Donation> {
  const { data, error } = await supabase
    .from('donations')
    .insert({
      sender_id: senderId,
      receiver_id: receiverId,
      video_id: videoId || null,
      stream_id: streamId || null,
      amount,
      type,
      message,
      status: 'completed',
    })
    .select()
    .single();
  if (error) throw error;
  return data as Donation;
}

export async function getCreatorDonations(creatorId: string, limit: number = 50): Promise<Donation[]> {
  const { data, error } = await supabase
    .from('donations')
    .select('*')
    .eq('receiver_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as Donation[];
}

export async function getCreatorRevenue(creatorId: string): Promise<{
  estimated: number;
  ad: number;
  premium: number;
  donations: number;
  memberships: number;
}> {
  const { data, error } = await supabase.rpc('get_creator_analytics_extended', { p_user_id: creatorId });
  if (error || !data) {
    return { estimated: 0, ad: 0, premium: 0, donations: 0, memberships: 0 };
  }
  const row = data[0] || data;
  return {
    estimated: row?.estimated_revenue || 0,
    ad: row?.ad_revenue || 0,
    premium: row?.premium_revenue || 0,
    donations: row?.donations_revenue || 0,
    memberships: row?.membership_revenue || 0,
  };
}

export interface RevenueBreakdown {
  estimated: number;
  ad: number;
  premium: number;
  donations: number;
  memberships: number;
}

export interface CreatorAnalyticsExtended {
  totalViews: number;
  totalLikes: number;
  totalComments: number;
  totalSubscribers: number;
  totalDownloads: number;
  avgWatchTime: number;
  totalWatchTime: number;
  liveViewers: number;
  totalStreams: number;
  returningViewers: number;
  revenue: RevenueBreakdown;
}

export async function getCreatorAnalyticsExtended(creatorId: string): Promise<CreatorAnalyticsExtended> {
  const { data, error } = await supabase.rpc('get_creator_analytics_extended', { p_user_id: creatorId });
  if (error || !data) {
    return {
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalSubscribers: 0,
      totalDownloads: 0,
      avgWatchTime: 0,
      totalWatchTime: 0,
      liveViewers: 0,
      totalStreams: 0,
      returningViewers: 0,
      revenue: { estimated: 0, ad: 0, premium: 0, donations: 0, memberships: 0 },
    };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return {
    totalViews: row?.total_views || 0,
    totalLikes: row?.total_likes || 0,
    totalComments: row?.total_comments || 0,
    totalSubscribers: row?.total_subscribers || 0,
    totalDownloads: row?.total_downloads || 0,
    avgWatchTime: row?.avg_watch_time || 0,
    totalWatchTime: row?.total_watch_time || 0,
    liveViewers: row?.live_viewers || 0,
    totalStreams: row?.total_streams || 0,
    returningViewers: row?.returning_viewers || 0,
    revenue: {
      estimated: row?.estimated_revenue || 0,
      ad: row?.ad_revenue || 0,
      premium: row?.premium_revenue || 0,
      donations: row?.donations_revenue || 0,
      memberships: row?.membership_revenue || 0,
    },
  };
}

export function formatRevenue(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(2)}K`;
  return `$${amount.toFixed(2)}`;
}
