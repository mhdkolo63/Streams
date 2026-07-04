import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Plus, Edit, Trash2, Star, Eye, EyeOff, TrendingUp, X, Check } from 'lucide-react-native';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function ManageVideosScreen() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredVideos, setFilteredVideos] = useState<Video[]>([]);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editYear, setEditYear] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchVideos = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('videos')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        setVideos(data);
        setFilteredVideos(data);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }

    fetchVideos();
  }, [authLoading, user, isAdmin, router, fetchVideos]);

  useEffect(() => {
    if (searchQuery.trim()) {
      const filtered = videos.filter(
        (v) =>
          v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          v.genre?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredVideos(filtered);
    } else {
      setFilteredVideos(videos);
    }
  }, [searchQuery, videos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchVideos();
    setRefreshing(false);
  }, [fetchVideos]);

  const toggleFeatured = async (video: Video) => {
    const { error } = await supabase
      .from('videos')
      .update({ featured: !video.featured })
      .eq('id', video.id);

    if (!error) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === video.id ? { ...v, featured: !v.featured } : v
        )
      );
    }
  };

  const toggleTrending = async (video: Video) => {
    const { error } = await supabase
      .from('videos')
      .update({ trending: !video.trending })
      .eq('id', video.id);

    if (!error) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === video.id ? { ...v, trending: !v.trending } : v
        )
      );
    }
  };

  const togglePublished = async (video: Video) => {
    const newStatus = video.status === 'published' ? 'draft' : 'published';
    const { error } = await supabase
      .from('videos')
      .update({ status: newStatus })
      .eq('id', video.id);

    if (!error) {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === video.id ? { ...v, status: newStatus as any } : v
        )
      );
    }
  };

  const deleteVideo = async (video: Video) => {
    Alert.alert(
      'Delete Video',
      `Are you sure you want to permanently delete "${video.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.from('videos').delete().eq('id', video.id);
              setVideos((prev) => prev.filter((v) => v.id !== video.id));
            } catch (error) {
              console.error('Error deleting video:', error);
              Alert.alert('Error', 'Failed to delete video');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (video: Video) => {
    setEditingVideo(video);
    setEditTitle(video.title);
    setEditDescription(video.description || '');
    setEditGenre(video.genre || '');
    setEditYear(video.release_year?.toString() || '');
    setEditModalVisible(true);
  };

  const saveEdit = async () => {
    if (!editingVideo || !editTitle.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('videos')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim() || null,
          genre: editGenre.trim() || null,
          release_year: editYear ? parseInt(editYear) : null,
        })
        .eq('id', editingVideo.id);

      if (error) throw error;

      setVideos((prev) =>
        prev.map((v) =>
          v.id === editingVideo.id
            ? {
                ...v,
                title: editTitle.trim(),
                description: editDescription.trim() || null,
                genre: editGenre.trim() || null,
                release_year: editYear ? parseInt(editYear) : null,
              }
            : v
        )
      );

      setEditModalVisible(false);
      setEditingVideo(null);
    } catch (error) {
      console.error('Error updating video:', error);
      Alert.alert('Error', 'Failed to update video');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <LoadingScreen />;
  }

  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>Access Denied</Text>
          <Text style={styles.unauthorizedSubtext}>Admin privileges required</Text>
        </View>
      </View>
    );
  }

  const renderVideoItem = ({ item }: { item: Video }) => {
    const duration = formatDuration(item.duration);
    const isPublished = item.status === 'published';

    return (
      <View style={styles.videoCard}>
        <Image
          source={{
            uri: item.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=160&h=90&fit=crop',
          }}
          style={styles.thumbnail}
        />
        <View style={styles.videoInfo}>
          <Text style={styles.videoTitle} numberOfLines={2}>{item.title}</Text>
          <View style={styles.videoMeta}>
            <Text style={styles.metaText}>{duration}</Text>
            {item.release_year && <Text style={styles.metaText}> - {item.release_year}</Text>}
          </View>
          <View style={styles.tagsRow}>
            {item.featured && (
              <View style={[styles.tag, styles.tagFeatured]}>
                <Star size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Featured</Text>
              </View>
            )}
            {item.trending && (
              <View style={[styles.tag, styles.tagTrending]}>
                <TrendingUp size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Trending</Text>
              </View>
            )}
            {!isPublished && (
              <View style={[styles.tag, styles.tagUnpublished]}>
                <EyeOff size={10} color={Colors.text.primary} />
                <Text style={styles.tagText}>Draft</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.videoActions}>
          <TouchableOpacity style={[styles.actionBtn, item.featured && styles.actionBtnActive]} onPress={() => toggleFeatured(item)}>
            <Star size={18} color={item.featured ? Colors.primary : Colors.text.muted} fill={item.featured ? Colors.primary : 'transparent'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, item.trending && styles.actionBtnActive]} onPress={() => toggleTrending(item)}>
            <TrendingUp size={18} color={item.trending ? Colors.status.info : Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionBtn, !isPublished && styles.actionBtnDanger]} onPress={() => togglePublished(item)}>
            {isPublished ? <Eye size={18} color={Colors.status.success} /> : <EyeOff size={18} color={Colors.text.muted} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openEditModal(item)}>
            <Edit size={18} color={Colors.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => deleteVideo(item)}>
            <Trash2 size={18} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.text.muted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search videos..."
            placeholderTextColor={Colors.text.muted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <Button title="" onPress={() => router.push('/admin/upload')} icon={<Plus size={20} color={Colors.text.primary} />} style={styles.addButton} />
      </View>

      <View style={styles.statsRow}>
        <Text style={styles.statsText}>{filteredVideos.length} videos</Text>
        <Text style={styles.statsSubtext}>{filteredVideos.filter(v => v.status === 'published').length} published</Text>
      </View>

      <FlatList
        data={filteredVideos}
        keyExtractor={(item) => item.id}
        renderItem={renderVideoItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No videos found</Text>
          </View>
        }
      />

      <Modal visible={editModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Video</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <X size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Input label="Title" value={editTitle} onChangeText={setEditTitle} placeholder="Video title" />
              <Input label="Description" value={editDescription} onChangeText={setEditDescription} placeholder="Video description" multiline numberOfLines={4} />
              <Input label="Genre" value={editGenre} onChangeText={setEditGenre} placeholder="e.g., Action, Drama" />
              <Input label="Release Year" value={editYear} onChangeText={setEditYear} placeholder="e.g., 2024" keyboardType="numeric" />
            </ScrollView>
            <View style={styles.modalFooter}>
              <Button title="Cancel" onPress={() => setEditModalVisible(false)} variant="outline" style={styles.modalBtn} />
              <Button title={saving ? 'Saving...' : 'Save Changes'} onPress={saveEdit} loading={saving} disabled={saving} style={styles.modalBtn} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.md },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.input, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, marginLeft: Spacing.sm },
  addButton: { width: 44, height: 44, padding: 0 },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.md },
  statsText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  statsSubtext: { fontSize: FontSizes.sm, color: Colors.text.muted },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  videoCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, marginBottom: Spacing.md, padding: Spacing.sm, alignItems: 'center' },
  thumbnail: { width: 100, height: 56, borderRadius: BorderRadius.sm },
  videoInfo: { flex: 1, marginLeft: Spacing.md, paddingVertical: Spacing.xs },
  videoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  videoMeta: { flexDirection: 'row', marginBottom: Spacing.xs },
  metaText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  tag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, gap: 2 },
  tagFeatured: { backgroundColor: Colors.primary },
  tagTrending: { backgroundColor: Colors.status.info },
  tagUnpublished: { backgroundColor: Colors.tertiary },
  tagText: { fontSize: FontSizes.xs, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  videoActions: { flexDirection: 'row', gap: 2 },
  actionBtn: { padding: Spacing.xs, borderRadius: BorderRadius.sm },
  actionBtnActive: { backgroundColor: `${Colors.primary}20` },
  actionBtnDanger: { backgroundColor: `${Colors.status.error}20` },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2 },
  emptyTitle: { fontSize: FontSizes.lg, color: Colors.text.secondary },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  unauthorizedSubtext: { fontSize: FontSizes.md, color: Colors.text.secondary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  modalBody: { padding: Spacing.lg },
  modalFooter: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.border },
  modalBtn: { flex: 1 },
});
