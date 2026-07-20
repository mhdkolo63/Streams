/**
 * Subscriptions service — full implementation for the creator subscription system.
 */

import { supabase, Subscription } from '@/lib/supabase';

export async function subscribeToChannel(
  subscriberId: string,
  channelId: string
): Promise<boolean> {
  if (subscriberId === channelId) return false;

  const { error } = await supabase
    .from('subscriptions')
    .insert({ subscriber_id: subscriberId, channel_id: channelId });

  return !error;
}

export async function unsubscribeFromChannel(
  subscriberId: string,
  channelId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('subscriber_id', subscriberId)
    .eq('channel_id', channelId);

  return !error;
}

export async function isSubscribed(
  subscriberId: string,
  channelId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('subscriber_id', subscriberId)
    .eq('channel_id', channelId)
    .maybeSingle();

  return !!data;
}

export async function getSubscriberCount(channelId: string): Promise<number> {
  const { count } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', channelId);

  return count || 0;
}

export async function getSubscriptions(userId: string): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*, channel:profiles!subscriptions_channel_id_fkey(*)')
    .eq('subscriber_id', userId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as unknown as Subscription[];
}

export async function getSubscribedChannelIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('subscriptions')
    .select('channel_id')
    .eq('subscriber_id', userId);

  if (!data) return new Set();
  return new Set(data.map((s: any) => s.channel_id));
}
