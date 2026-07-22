import { supabase } from './supabase';
import type { LiveStream, LiveChatMessage, Profile } from './supabase';

export interface LiveStreamWithCreator extends LiveStream {
  creator_name?: string;
  creator_avatar?: string | null;
  subscriber_count?: number;
}

export async function getPlatformSettings() {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePlatformSettings(updates: Record<string, boolean>) {
  const { data, error } = await supabase
    .from('platform_settings')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', 1)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getLiveStreams(status: string = 'live', limit: number = 20): Promise<LiveStreamWithCreator[]> {
  const { data, error } = await supabase.rpc('get_live_streams', {
    p_status: status,
    p_limit: limit,
  });
  if (error) {
    const { data: fallback, error: err2 } = await supabase
      .from('live_streams')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (err2) throw err2;
    return (fallback || []) as LiveStreamWithCreator[];
  }
  return (data || []) as LiveStreamWithCreator[];
}

export async function getLiveStreamById(id: string): Promise<LiveStreamWithCreator | null> {
  const { data, error } = await supabase
    .from('live_streams')
    .select(`
      *,
      profiles!live_streams_creator_id_fkey(full_name, avatar_url, username)
    `)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profile = data.profiles as unknown as { full_name: string; avatar_url: string | null; username: string | null };
  const { data: subCount } = await supabase
    .from('subscriptions')
    .select('id', { count: 'exact', head: true })
    .eq('channel_id', data.creator_id);
  return {
    ...data,
    creator_name: profile?.full_name,
    creator_avatar: profile?.avatar_url,
    subscriber_count: subCount || 0,
  } as LiveStreamWithCreator;
}

export async function createLiveStream(
  creatorId: string,
  payload: {
    title: string;
    description?: string;
    thumbnail_url?: string;
    stream_url?: string;
    scheduled_start?: string;
    is_premium?: boolean;
    is_member_only?: boolean;
  }
): Promise<LiveStream> {
  const status = payload.scheduled_start ? 'scheduled' : 'live';
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('live_streams')
    .insert({
      creator_id: creatorId,
      title: payload.title,
      description: payload.description || '',
      thumbnail_url: payload.thumbnail_url || null,
      stream_url: payload.stream_url || null,
      scheduled_start: payload.scheduled_start || null,
      is_premium: payload.is_premium || false,
      is_member_only: payload.is_member_only || false,
      status,
      started_at: status === 'live' ? now : null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LiveStream;
}

export async function updateLiveStream(
  streamId: string,
  updates: Partial<LiveStream>
): Promise<LiveStream> {
  const { data, error } = await supabase
    .from('live_streams')
    .update(updates)
    .eq('id', streamId)
    .select()
    .single();
  if (error) throw error;
  return data as LiveStream;
}

export async function startLiveStream(streamId: string): Promise<LiveStream> {
  return updateLiveStream(streamId, {
    status: 'live',
    started_at: new Date().toISOString(),
  });
}

export async function endLiveStream(streamId: string): Promise<LiveStream> {
  return updateLiveStream(streamId, {
    status: 'ended',
    ended_at: new Date().toISOString(),
  });
}

export async function cancelLiveStream(streamId: string): Promise<LiveStream> {
  return updateLiveStream(streamId, { status: 'cancelled' });
}

export async function updateStreamChatSettings(
  streamId: string,
  settings: {
    chat_enabled?: boolean;
    slow_mode?: boolean;
    slow_mode_interval?: number;
    subscriber_only_chat?: boolean;
  }
): Promise<LiveStream> {
  return updateLiveStream(streamId, settings);
}

export async function incrementStreamViewers(streamId: string, increment: number = 1): Promise<void> {
  const { error } = await supabase.rpc('increment_stream_viewers', {
    p_stream_id: streamId,
    p_increment: increment,
  });
  if (error) {
    const stream = await getLiveStreamById(streamId);
    if (stream) {
      const newCount = Math.max(0, stream.viewer_count + increment);
      await updateLiveStream(streamId, {
        viewer_count: newCount,
        peak_viewers: Math.max(stream.peak_viewers, newCount),
      });
    }
  }
}

export async function getCreatorLiveStreams(creatorId: string, limit: number = 20): Promise<LiveStream[]> {
  const { data, error } = await supabase
    .from('live_streams')
    .select('*')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as LiveStream[];
}

export async function getScheduledStreams(limit: number = 20): Promise<LiveStreamWithCreator[]> {
  return getLiveStreams('scheduled', limit);
}

export async function featureStream(streamId: string, featured: boolean): Promise<void> {
  await updateLiveStream(streamId, { is_featured: featured } as Partial<LiveStream>);
}

export async function adminEndStream(streamId: string): Promise<void> {
  await endLiveStream(streamId);
}

export async function adminRemoveChatMessages(streamId: string): Promise<void> {
  await supabase
    .from('live_chat_messages')
    .delete()
    .eq('stream_id', streamId);
}

export async function getChatMessages(
  streamId: string,
  limit: number = 50
): Promise<(LiveChatMessage & { profiles?: Profile })[]> {
  const { data, error } = await supabase
    .from('live_chat_messages')
    .select(`
      *,
      profiles!live_chat_messages_user_id_fkey(id, full_name, avatar_url, username, is_admin)
    `)
    .eq('stream_id', streamId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []) as (LiveChatMessage & { profiles?: Profile })[];
}

export async function sendChatMessage(
  streamId: string,
  userId: string,
  body: string,
  parentId?: string
): Promise<LiveChatMessage> {
  const { data, error } = await supabase
    .from('live_chat_messages')
    .insert({
      stream_id: streamId,
      user_id: userId,
      body,
      parent_id: parentId || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LiveChatMessage;
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from('live_chat_messages')
    .delete()
    .eq('id', messageId);
  if (error) throw error;
}

export async function pinChatMessage(messageId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase
    .from('live_chat_messages')
    .update({ is_pinned: pinned })
    .eq('id', messageId);
  if (error) throw error;
}

export async function getPinnedMessage(streamId: string): Promise<LiveChatMessage | null> {
  const { data, error } = await supabase
    .from('live_chat_messages')
    .select('*')
    .eq('stream_id', streamId)
    .eq('is_pinned', true)
    .maybeSingle();
  if (error) throw error;
  return data as LiveChatMessage | null;
}

export function subscribeToChat(
  streamId: string,
  callback: (payload: { eventType: string; new: LiveChatMessage; old: LiveChatMessage | null }) => void
) {
  return supabase
    .channel(`live_chat:${streamId}`)
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${streamId}` },
      callback as any
    )
    .subscribe();
}

export function subscribeToStreamUpdates(
  streamId: string,
  callback: (payload: { eventType: string; new: LiveStream; old: LiveStream | null }) => void
) {
  return supabase
    .channel(`live_stream:${streamId}`)
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'live_streams', filter: `id=eq.${streamId}` },
      callback as any
    )
    .subscribe();
}

export function subscribeToStreams(
  callback: (payload: { eventType: string; new: LiveStream; old: LiveStream | null }) => void
) {
  return supabase
    .channel('live_streams_all')
    .on(
      'postgres_changes' as any,
      { event: '*', schema: 'public', table: 'live_streams' },
      callback as any
    )
    .subscribe();
}

export function formatStreamDuration(startedAt: string | null, endedAt: string | null): string {
  if (!startedAt) return '0:00';
  const end = endedAt ? new Date(endedAt) : new Date();
  const start = new Date(startedAt);
  const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function formatViewerCount(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return `${count}`;
}
