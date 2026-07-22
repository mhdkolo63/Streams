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
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  MoreVertical,
  Edit2,
  Trash2,
  Play,
  Film,
  Eye,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { deleteCreatorVideo, getCreatorVideos, updateCreatorVideo } from '@/lib/creators';

export default function StudioDraftsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [drafts, setDrafts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const videos = await getCreatorVideos(user.id);
      const draftVideos = videos.filter((v) => v.status === 'draft' && !(v as any).scheduled_at);
      setDrafts(draftVideos);
    } catch (error) {
      console.error('Error fetching drafts:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDrafts();
    setRefreshing(false);
  }, [fetchDrafts]);

  const handleDeleteDraft = (draft: Video) => {
    setMenuOpenId(null);
    Alert.alert(
      'Delete Draft',
      `Delete "${draft.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const success = await deleteCreatorVideo(draft.id, user.id);
            if (success) {
              setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
              toast.success('Draft deleted');
            }
          },
        },
      ]
    );
  };

  const handlePublishDraft = async (draft: Video) => {
    setMenuOpenId(null);
    if (!user) return;
    const success = await updateCreatorVideo(draft.id, user.id, { status: 'published' } as any);
    if (success) {
      setDrafts((prev) => prev.filter((d) => d.id !== draft.id));
      toast.success('Draft published', 'Your video is now live');
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderDraft = ({ item, index }: { item: Video; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={styles.draftCard}>
      <TouchableOpacity style={styles.cardBody} onPress={() => router.push(`/studio/edit/${item.id}`)} activeOpacity={0.7}>
        <View style={styles.thumbnailContainer}>
          {item.thumbnail_url ? (
            <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <FileText size={24} color={Colors.text.muted} />
            </View>
          )}
          <View style={styles.draftBadge}>
            <FileText size={10} color={Colors.text.primary} />
            <Text style={styles.draftBadgeText}>DRAFT</Text>
          </View>
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.cardMeta}>Last edited {formatDate(item.created_at)}</Text>
          {(item as any).duration > 0 && (
            <Text style={styles.cardDuration}>Duration: {Math.round((item as any).duration)}s</Text>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push(`/studio/edit/${item.id}`)}>
          <Edit2 size={18} color={Colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={() => setMenuOpenId(menuOpenId === item.id ? null : item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MoreVertical size={18} color={Colors.text.secondary} />
        </TouchableOpacity>
      </View>

      {menuOpenId === item.id && (
        <View style={styles.dropdownMenu}>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpenId(null); router.push(`/studio/edit/${item.id}`); }}>
            <Edit2 size={16} color={Colors.text.primary} />
            <Text style={styles.dropdownText}>Continue Editing</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dropdownItem} onPress={() => handlePublishDraft(item)}>
            <Play size={16} color={Colors.status.success} />
            <Text style={styles.dropdownText}>Publish Now</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.dropdownItem, styles.dropdownDelete]} onPress={() => handleDeleteDraft(item)}>
            <Trash2 size={16} color={Colors.status.error} />
            <Text style={[styles.dropdownText, { color: Colors.status.error }]}>Delete Draft</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Drafts</Text>
          <Text style={styles.headerCount}>{drafts.length}</Text>
        </View>

        <Text style={styles.subtitle}>Continue editing your unfinished videos</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading drafts...</Text>
          </View>
        ) : drafts.length === 0 ? (
          <EmptyState
            type="custom"
            icon={<FileText size={64} color={Colors.text.muted} />}
            title="No drafts"
            message="Save a video as a draft to continue editing it later."
            onAction={() => router.push('/studio/upload')}
            actionLabel="Upload Video"
          />
        ) : (
          <FlatList
            data={drafts}
            keyExtractor={(item) => item.id}
            renderItem={renderDraft}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xs, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  headerCount: { fontSize: FontSizes.sm, color: Colors.text.muted, backgroundColor: Colors.tertiary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  subtitle: { fontSize: FontSizes.sm, color: Colors.text.muted, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  draftCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', position: 'relative' },
  cardBody: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md },
  thumbnailContainer: { position: 'relative' },
  thumbnail: { width: 120, height: 68, borderRadius: BorderRadius.md },
  thumbnailPlaceholder: { width: 120, height: 68, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  draftBadge: { position: 'absolute', top: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  draftBadgeText: { fontSize: 9, color: Colors.text.primary, fontWeight: FontWeights.bold },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4 },
  cardMeta: { fontSize: FontSizes.xs, color: Colors.text.muted },
  cardDuration: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  cardActions: { position: 'absolute', top: Spacing.md, right: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  actionBtn: { padding: Spacing.xs },
  menuButton: { padding: Spacing.xs },
  dropdownMenu: { position: 'absolute', top: 40, right: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, zIndex: 100, minWidth: 180, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  dropdownText: { fontSize: FontSizes.sm, color: Colors.text.primary },
  dropdownDelete: { marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.muted },
});
