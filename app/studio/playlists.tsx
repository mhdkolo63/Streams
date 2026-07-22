import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Plus,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  ListVideo,
  Eye,
  EyeOff,
  Lock,
  GripVertical,
  X,
  Check,
  Film,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Playlist, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import {
  getPlaylists,
  createPlaylist,
  deletePlaylist,
  renamePlaylist,
  getPlaylistVideos,
  reorderPlaylistVideos,
  removeFromPlaylist,
  type PlaylistVideo,
} from '@/lib/creators/playlists';

type PrivacyLevel = 'public' | 'unlisted' | 'private';

export default function StudioPlaylistsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<Playlist | null>(null);
  const [showVideosModal, setShowVideosModal] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistVideos, setPlaylistVideos] = useState<PlaylistVideo[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newPrivacy, setNewPrivacy] = useState<PrivacyLevel>('public');

  const fetchPlaylists = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await getPlaylists(user.id);
      const userPlaylists = data.filter((p) => !p.is_system);
      setPlaylists(userPlaylists);
    } catch (error) {
      console.error('Error fetching playlists:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchPlaylists();
    setRefreshing(false);
  }, [fetchPlaylists]);

  const handleCreate = async () => {
    if (!user || !newTitle.trim()) return;
    try {
      const created = await createPlaylist(user.id, newTitle, newDesc);
      if (created) {
        await supabase.from('playlists').update({ status: newPrivacy }).eq('id', created.id);
        toast.success('Playlist created', newTitle);
        setShowCreateModal(false);
        setNewTitle('');
        setNewDesc('');
        setNewPrivacy('public');
        fetchPlaylists();
      }
    } catch (error) {
      toast.error('Failed to create playlist', 'Please try again');
    }
  };

  const handleDelete = (playlist: Playlist) => {
    setMenuOpenId(null);
    Alert.alert('Delete Playlist', `Delete "${playlist.title}"? Videos will not be deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const success = await deletePlaylist(playlist.id);
          if (success) {
            setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
            toast.success('Playlist deleted');
          }
        },
      },
    ]);
  };

  const handleRename = async () => {
    if (!editingPlaylist || !newTitle.trim()) return;
    const success = await renamePlaylist(editingPlaylist.id, newTitle);
    if (success) {
      await supabase.from('playlists').update({ status: newPrivacy }).eq('id', editingPlaylist.id);
      setPlaylists((prev) =>
        prev.map((p) =>
          p.id === editingPlaylist.id ? { ...p, title: newTitle, status: newPrivacy } : p
        )
      );
      toast.success('Playlist updated');
      setShowEditModal(false);
      setEditingPlaylist(null);
      setNewTitle('');
      setNewPrivacy('public');
    }
  };

  const handleViewVideos = async (playlist: Playlist) => {
    setMenuOpenId(null);
    setSelectedPlaylist(playlist);
    setShowVideosModal(true);
    const videos = await getPlaylistVideos(playlist.id);
    setPlaylistVideos(videos);
  };

  const handleRemoveVideo = async (videoId: string) => {
    if (!selectedPlaylist) return;
    const success = await removeFromPlaylist(selectedPlaylist.id, videoId);
    if (success) {
      setPlaylistVideos((prev) => prev.filter((v) => v.video_id !== videoId));
      toast.success('Video removed from playlist');
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0 || !selectedPlaylist) return;
    const newOrder = [...playlistVideos];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setPlaylistVideos(newOrder);
    const videoIds = newOrder.map((v) => v.video_id);
    await reorderPlaylistVideos(selectedPlaylist.id, videoIds);
  };

  const handleMoveDown = async (index: number) => {
    if (index === playlistVideos.length - 1 || !selectedPlaylist) return;
    const newOrder = [...playlistVideos];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setPlaylistVideos(newOrder);
    const videoIds = newOrder.map((v) => v.video_id);
    await reorderPlaylistVideos(selectedPlaylist.id, videoIds);
  };

  const getPrivacyIcon = (status: string) => {
    switch (status) {
      case 'public': return <Eye size={12} color={Colors.status.success} />;
      case 'unlisted': return <EyeOff size={12} color="#F59E0B" />;
      case 'private': return <Lock size={12} color={Colors.text.muted} />;
      default: return <Eye size={12} color={Colors.status.success} />;
    }
  };

  const renderPlaylist = ({ item, index }: { item: Playlist; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={styles.playlistCard}>
      <TouchableOpacity style={styles.cardBody} onPress={() => handleViewVideos(item)} activeOpacity={0.7}>
        <View style={styles.thumbnailContainer}>
          <View style={styles.thumbnailPlaceholder}>
            <ListVideo size={28} color={Colors.text.muted} />
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{item.video_count || 0}</Text>
          </View>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          {item.description && <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>}
          <View style={styles.cardMeta}>
            {getPrivacyIcon(item.status)}
            <Text style={styles.privacyText}>{item.status || 'public'}</Text>
          </View>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.menuButton}
        onPress={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <MoreVertical size={18} color={Colors.text.secondary} />
      </TouchableOpacity>
      {menuOpenId === item.id && (
        <Animated.View entering={FadeIn.duration(150)} style={styles.dropdownMenu}>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => handleViewVideos(item)}>
            <Play size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>View Videos</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => {
            setMenuOpenId(null);
            setEditingPlaylist(item);
            setNewTitle(item.title);
            setNewPrivacy((item.status as PrivacyLevel) || 'public');
            setShowEditModal(true);
          }}>
            <Edit2 size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dropdownItem, styles.dropdownDelete]} onPress={() => handleDelete(item)}>
            <Trash2 size={16} color={Colors.status.error} />
            <Text style={[styles.dropdownText, { color: Colors.status.error }]}>Delete</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </Animated.View>
  );

  const privacyOptions: { value: PrivacyLevel; label: string; icon: any }[] = [
    { value: 'public', label: 'Public', icon: Eye },
    { value: 'unlisted', label: 'Unlisted', icon: EyeOff },
    { value: 'private', label: 'Private', icon: Lock },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Playlists</Text>
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
            <Plus size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading playlists...</Text>
          </View>
        ) : playlists.length === 0 ? (
          <EmptyState
            type="custom"
            icon={<ListVideo size={64} color={Colors.text.muted} />}
            title="No playlists"
            message="Create playlists to organize your videos."
            onAction={() => setShowCreateModal(true)}
            actionLabel="Create Playlist"
          />
        ) : (
          <FlatList
            data={playlists}
            keyExtractor={(item) => item.id}
            renderItem={renderPlaylist}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Create Playlist Modal */}
        <Modal visible={showCreateModal} transparent animationType="fade" onRequestClose={() => setShowCreateModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Playlist</Text>
                <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                  <X size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <Input label="Title *" value={newTitle} onChangeText={setNewTitle} placeholder="Playlist title" />
              <Input label="Description" value={newDesc} onChangeText={setNewDesc} placeholder="Optional description" multiline numberOfLines={2} />
              <Text style={styles.modalLabel}>Privacy</Text>
              <View style={styles.privacyRow}>
                {privacyOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.privacyOption, newPrivacy === opt.value && styles.privacyOptionActive]}
                    onPress={() => setNewPrivacy(opt.value)}
                  >
                    <opt.icon size={16} color={newPrivacy === opt.value ? Colors.primary : Colors.text.muted} />
                    <Text style={[styles.privacyText, newPrivacy === opt.value && styles.privacyTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button title="Create" onPress={handleCreate} disabled={!newTitle.trim()} style={styles.modalButton} />
            </View>
          </View>
        </Modal>

        {/* Edit Playlist Modal */}
        <Modal visible={showEditModal} transparent animationType="fade" onRequestClose={() => setShowEditModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Playlist</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <X size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <Input label="Title *" value={newTitle} onChangeText={setNewTitle} placeholder="Playlist title" />
              <Text style={styles.modalLabel}>Privacy</Text>
              <View style={styles.privacyRow}>
                {privacyOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.privacyOption, newPrivacy === opt.value && styles.privacyOptionActive]}
                    onPress={() => setNewPrivacy(opt.value)}
                  >
                    <opt.icon size={16} color={newPrivacy === opt.value ? Colors.primary : Colors.text.muted} />
                    <Text style={[styles.privacyText, newPrivacy === opt.value && styles.privacyTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button title="Save Changes" onPress={handleRename} disabled={!newTitle.trim()} style={styles.modalButton} />
            </View>
          </View>
        </Modal>

        {/* Videos in Playlist Modal */}
        <Modal visible={showVideosModal} transparent animationType="slide" onRequestClose={() => setShowVideosModal(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.videosModalCard}>
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle} numberOfLines={1}>{selectedPlaylist?.title}</Text>
                  <Text style={styles.modalSubtitle}>{playlistVideos.length} videos</Text>
                </View>
                <TouchableOpacity onPress={() => setShowVideosModal(false)}>
                  <X size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>
              {playlistVideos.length === 0 ? (
                <View style={styles.emptyModal}>
                  <Film size={48} color={Colors.text.muted} />
                  <Text style={styles.emptyModalText}>No videos in this playlist</Text>
                </View>
              ) : (
                <FlatList
                  data={playlistVideos}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item, index }) => {
                    const video = item.video as any;
                    return (
                      <View style={styles.playlistVideoItem}>
                        <View style={styles.videoLeft}>
                          <Text style={styles.videoIndex}>{index + 1}</Text>
                          <View style={styles.moveButtons}>
                            <TouchableOpacity onPress={() => handleMoveUp(index)} disabled={index === 0}>
                              <Text style={[styles.moveBtn, index === 0 && styles.moveBtnDisabled]}>▲</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleMoveDown(index)} disabled={index === playlistVideos.length - 1}>
                              <Text style={[styles.moveBtn, index === playlistVideos.length - 1 && styles.moveBtnDisabled]}>▼</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        <View style={styles.videoInfo}>
                          {video?.thumbnail_url && <Image source={{ uri: video.thumbnail_url }} style={styles.videoThumb} />}
                          <View style={styles.videoDetails}>
                            <Text style={styles.videoTitle} numberOfLines={2}>{video?.title || 'Unknown'}</Text>
                            <Text style={styles.videoDuration}>{video?.duration ? `${Math.round(video.duration)}s` : ''}</Text>
                          </View>
                        </View>
                        <TouchableOpacity onPress={() => handleRemoveVideo(item.video_id)} style={styles.removeVideoBtn}>
                          <Trash2 size={16} color={Colors.status.error} />
                        </TouchableOpacity>
                      </View>
                    );
                  }}
                  showsVerticalScrollIndicator={false}
                />
              )}
            </View>
          </View>
        </Modal>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.md, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  createBtn: { padding: Spacing.sm, backgroundColor: Colors.primary, borderRadius: BorderRadius.md },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  playlistCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', position: 'relative', flexDirection: 'row' },
  cardBody: { flex: 1, flexDirection: 'row', padding: Spacing.md, gap: Spacing.md },
  thumbnailContainer: { position: 'relative' },
  thumbnailPlaceholder: { width: 80, height: 80, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  countBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: BorderRadius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  countText: { fontSize: 10, color: Colors.text.primary, fontWeight: FontWeights.bold },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4 },
  cardDesc: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  privacyText: { fontSize: FontSizes.xs, color: Colors.text.muted, textTransform: 'capitalize' },
  menuButton: { padding: Spacing.xs, position: 'absolute', top: Spacing.md, right: Spacing.md, zIndex: 10 },
  dropdownMenu: { position: 'absolute', top: 40, right: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, zIndex: 100, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  dropdownText: { fontSize: FontSizes.sm, color: Colors.text.primary },
  dropdownDelete: { marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.muted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 500, maxHeight: '80%' },
  videosModalCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 600, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  modalSubtitle: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  modalLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.xs, marginTop: Spacing.sm },
  privacyRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  privacyOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center' },
  privacyOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  privacyTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  modalButton: { marginTop: Spacing.md },
  emptyModal: { alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md },
  emptyModalText: { fontSize: FontSizes.md, color: Colors.text.muted },
  playlistVideoItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: Spacing.sm },
  videoLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, width: 60 },
  videoIndex: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.semibold, width: 20 },
  moveButtons: { flexDirection: 'column', gap: 2 },
  moveBtn: { fontSize: 10, color: Colors.text.secondary },
  moveBtnDisabled: { opacity: 0.3 },
  videoInfo: { flex: 1, flexDirection: 'row', gap: Spacing.sm },
  videoThumb: { width: 60, height: 34, borderRadius: BorderRadius.sm },
  videoDetails: { flex: 1, justifyContent: 'center' },
  videoTitle: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium },
  videoDuration: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  removeVideoBtn: { padding: Spacing.sm },
});
