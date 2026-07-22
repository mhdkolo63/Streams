import { supabase, Playlist, PlaylistVideo, Video } from '@/lib/supabase';
import { sanitizeString } from '@/lib/validation';

export type { Playlist, PlaylistVideo };

export async function getPlaylists(userId: string): Promise<Playlist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .or(`creator_id.eq.${userId},user_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return data as Playlist[];
}

export async function getPlaylist(playlistId: string): Promise<Playlist | null> {
  const { data, error } = await supabase
    .from('playlists')
    .select('*')
    .eq('id', playlistId)
    .maybeSingle();

  if (error || !data) return null;
  return data as Playlist;
}

export async function createPlaylist(
  userId: string,
  title: string,
  description?: string
): Promise<Playlist | null> {
  const { data, error } = await supabase
    .from('playlists')
    .insert({
      creator_id: userId,
      user_id: userId,
      title: sanitizeString(title, 100),
      description: description ? sanitizeString(description, 500) : null,
      status: 'public',
      video_count: 0,
    })
    .select('*')
    .single();

  if (error || !data) return null;
  return data as Playlist;
}

export async function renamePlaylist(
  playlistId: string,
  title: string
): Promise<boolean> {
  const { error } = await supabase
    .from('playlists')
    .update({ title: sanitizeString(title, 100), updated_at: new Date().toISOString() })
    .eq('id', playlistId);

  return !error;
}

export async function deletePlaylist(playlistId: string): Promise<boolean> {
  const { error } = await supabase
    .from('playlists')
    .delete()
    .eq('id', playlistId);

  return !error;
}

export async function getPlaylistVideos(playlistId: string): Promise<PlaylistVideo[]> {
  const { data, error } = await supabase
    .from('playlist_videos')
    .select('*, video:videos(*)')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (error || !data) return [];
  return data as unknown as PlaylistVideo[];
}

export async function addToPlaylist(
  playlistId: string,
  videoId: string
): Promise<boolean> {
  const { data: existing } = await supabase
    .from('playlist_videos')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('video_id', videoId)
    .maybeSingle();

  if (existing) return true;

  const { count } = await supabase
    .from('playlist_videos')
    .select('id', { count: 'exact', head: true })
    .eq('playlist_id', playlistId);

  const nextPosition = count || 0;

  const { error } = await supabase
    .from('playlist_videos')
    .insert({
      playlist_id: playlistId,
      video_id: videoId,
      position: nextPosition,
    });

  if (!error) {
    await supabase.rpc('increment_playlist_count', { p_playlist_id: playlistId }).then(() => {});
    await supabase
      .from('playlists')
      .update({ video_count: (count || 0) + 1, updated_at: new Date().toISOString() })
      .eq('id', playlistId);
  }

  return !error;
}

export async function removeFromPlaylist(
  playlistId: string,
  videoId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('playlist_videos')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('video_id', videoId);

  if (!error) {
    const { count } = await supabase
      .from('playlist_videos')
      .select('id', { count: 'exact', head: true })
      .eq('playlist_id', playlistId);

    await supabase
      .from('playlists')
      .update({ video_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', playlistId);
  }

  return !error;
}

export async function reorderPlaylistVideos(
  playlistId: string,
  videoIds: string[]
): Promise<boolean> {
  const updates = videoIds.map((videoId, index) =>
    supabase
      .from('playlist_videos')
      .update({ position: index })
      .eq('playlist_id', playlistId)
      .eq('video_id', videoId)
  );

  const results = await Promise.all(updates);
  return results.every((r) => !r.error);
}

export async function ensureSystemPlaylists(userId: string): Promise<void> {
  const systemTypes = ['watch_later', 'liked_videos', 'history'];

  for (const type of systemTypes) {
    const { data: existing } = await supabase
      .from('playlists')
      .select('id')
      .eq('user_id', userId)
      .eq('is_system', true)
      .eq('system_type', type)
      .maybeSingle();

    if (!existing) {
      const titles: Record<string, string> = {
        watch_later: 'Watch Later',
        liked_videos: 'Liked Videos',
        history: 'History',
      };

      await supabase.from('playlists').insert({
        creator_id: userId,
        user_id: userId,
        title: titles[type],
        is_system: true,
        system_type: type,
        status: 'private',
        video_count: 0,
      });
    }
  }
}

export async function getSystemPlaylistId(
  userId: string,
  systemType: string
): Promise<string | null> {
  const { data } = await supabase
    .from('playlists')
    .select('id')
    .eq('user_id', userId)
    .eq('is_system', true)
    .eq('system_type', systemType)
    .maybeSingle();

  return data?.id || null;
}

export async function toggleWatchLater(
  userId: string,
  videoId: string
): Promise<{ added: boolean; playlistId: string | null }> {
  const playlistId = await getSystemPlaylistId(userId, 'watch_later');
  if (!playlistId) {
    await ensureSystemPlaylists(userId);
    const newId = await getSystemPlaylistId(userId, 'watch_later');
    if (!newId) return { added: false, playlistId: null };
    const added = await addToPlaylist(newId, videoId);
    return { added, playlistId: newId };
  }

  const { data: existing } = await supabase
    .from('playlist_videos')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('video_id', videoId)
    .maybeSingle();

  if (existing) {
    await removeFromPlaylist(playlistId, videoId);
    return { added: false, playlistId };
  }

  await addToPlaylist(playlistId, videoId);
  return { added: true, playlistId };
}

export async function isInWatchLater(
  userId: string,
  videoId: string
): Promise<boolean> {
  const playlistId = await getSystemPlaylistId(userId, 'watch_later');
  if (!playlistId) return false;

  const { data } = await supabase
    .from('playlist_videos')
    .select('id')
    .eq('playlist_id', playlistId)
    .eq('video_id', videoId)
    .maybeSingle();

  return !!data;
}
