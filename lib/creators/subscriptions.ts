import { supabase, Subscription } from '@/lib/supabase';

export type { Subscription };

export type NotificationPreference = 'all' | 'personalized' | 'none';

export async function subscribeToChannel(
  subscriberId: string,
  channelId: string
): Promise<boolean> {
  if (subscriberId === channelId) return false;

  const { error } = await supabase
    .from('subscriptions')
    .insert({
      subscriber_id: subscriberId,
      channel_id: channelId,
      notification_preference: 'personalized',
    });

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

export async function getSubscriptionInfo(
  subscriberId: string,
  channelId: string
): Promise<Subscription | null> {
  const { data } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('subscriber_id', subscriberId)
    .eq('channel_id', channelId)
    .maybeSingle();

  if (!data) return null;
  return data as Subscription;
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

export async function updateNotificationPreference(
  subscriberId: string,
  channelId: string,
  preference: NotificationPreference
): Promise<boolean> {
  const { error } = await supabase
    .from('subscriptions')
    .update({ notification_preference: preference })
    .eq('subscriber_id', subscriberId)
    .eq('channel_id', channelId);

  return !error;
}

export async function getLatestSubscribers(
  channelId: string,
  limit = 10
): Promise<{ id: string; subscriber: { id: string; full_name: string | null; avatar_url: string | null; username: string | null } }[]> {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, created_at, subscriber:profiles!subscriptions_subscriber_id_fkey(id, full_name, avatar_url, username)')
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as any;
}
