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
  Calendar,
  Clock,
  Globe,
  Trash2,
  Play,
  Film,
  Star,
  Edit2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { deleteCreatorVideo, getCreatorVideos, updateCreatorVideo } from '@/lib/creators';

export default function StudioScheduledScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [scheduled, setScheduled] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const fetchScheduled = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const videos = await getCreatorVideos(user.id);
      const scheduledVideos = videos.filter(
        (v) => (v as any).scheduled_at || (v as any).premiere_at
      );
      setScheduled(scheduledVideos);
    } catch (error) {
      console.error('Error fetching scheduled:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchScheduled();
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [fetchScheduled]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchScheduled();
    setRefreshing(false);
  }, [fetchScheduled]);

  const handleDelete = (video: Video) => {
    setMenuOpenId(null);
    Alert.alert('Delete Scheduled Video', `Delete "${video.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          const success = await deleteCreatorVideo(video.id, user.id);
          if (success) {
            setScheduled((prev) => prev.filter((v) => v.id !== video.id));
            toast.success('Scheduled video deleted');
          }
        },
      },
    ]);
  };

  const handlePublishNow = async (video: Video) => {
    setMenuOpenId(null);
    if (!user) return;
    const success = await updateCreatorVideo(video.id, user.id, {
      status: 'published',
      scheduled_at: null,
    } as any);
    if (success) {
      setScheduled((prev) => prev.filter((v) => v.id !== video.id));
      toast.success('Published now', 'Your video is live');
    }
  };

  const formatCountdown = (targetDate: string): { text: string; urgent: boolean } => {
    const target = new Date(targetDate).getTime();
    const diff = target - now;
    if (diff <= 0) return { text: 'Publishing...', urgent: true };
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    if (days > 0) return { text: `${days}d ${hours}h ${mins}m`, urgent: false };
    if (hours > 0) return { text: `${hours}h ${mins}m ${secs}s`, urgent: false };
    if (mins > 0) return { text: `${mins}m ${secs}s`, urgent: true };
    return { text: `${secs}s`, urgent: true };
  };

  const formatScheduleDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const renderScheduledItem = ({ item, index }: { item: Video; index: number }) => {
    const scheduledAt = (item as any).scheduled_at || (item as any).premiere_at;
    const isPremiere = (item as any).premiere_at;
    const countdown = scheduledAt ? formatCountdown(scheduledAt) : { text: '', urgent: false };

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={styles.scheduledCard}>
        <TouchableOpacity style={styles.cardBody} onPress={() => router.push(`/studio/edit/${item.id}`)} activeOpacity={0.7}>
          <View style={styles.thumbnailContainer}>
            {item.thumbnail_url ? (
              <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <View style={styles.thumbnailPlaceholder}>
                <Film size={24} color={Colors.text.muted} />
              </View>
            )}
            {isPremiere && (
              <View style={styles.premiereBadge}>
                <Star size={10} color="#FFD700" fill="#FFD700" />
                <Text style={styles.premiereBadgeText}>PREMIERE</Text>
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
            <View style={styles.scheduleInfo}>
              <Calendar size={14} color={Colors.text.muted} />
              <Text style={styles.scheduleDate}>{formatScheduleDate(scheduledAt)}</Text>
            </View>
            <View style={[styles.countdownBadge, countdown.urgent && styles.countdownUrgent]}>
              <Clock size={12} color={countdown.urgent ? Colors.status.warning : Colors.status.success} />
              <Text style={[styles.countdownText, countdown.urgent && styles.countdownTextUrgent]}>
                {countdown.text}
              </Text>
            </View>
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
            <TouchableOpacity style={styles.dropdownItem} onPress={() => handlePublishNow(item)}>
              <Globe size={16} color={Colors.status.success} />
              <Text style={styles.dropdownText}>Publish Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dropdownItem} onPress={() => { setMenuOpenId(null); router.push(`/studio/edit/${item.id}`); }}>
              <Edit2 size={16} color={Colors.text.primary} />
              <Text style={styles.dropdownText}>Edit Schedule</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.dropdownItem, styles.dropdownDelete]} onPress={() => handleDelete(item)}>
              <Trash2 size={16} color={Colors.status.error} />
              <Text style={[styles.dropdownText, { color: Colors.status.error }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scheduled</Text>
          <Text style={styles.headerCount}>{scheduled.length}</Text>
        </View>

        <Text style={styles.subtitle}>Videos queued for automatic publishing</Text>

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading scheduled videos...</Text>
          </View>
        ) : scheduled.length === 0 ? (
          <EmptyState
            type="custom"
            icon={<Calendar size={64} color={Colors.text.muted} />}
            title="No scheduled videos"
            message="Schedule a video during upload to see it here with a live countdown."
            onAction={() => router.push('/studio/upload')}
            actionLabel="Upload Video"
          />
        ) : (
          <FlatList
            data={scheduled}
            keyExtractor={(item) => item.id}
            renderItem={renderScheduledItem}
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
  scheduledCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', position: 'relative' },
  cardBody: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.md },
  thumbnailContainer: { position: 'relative' },
  thumbnail: { width: 120, height: 68, borderRadius: BorderRadius.md },
  thumbnailPlaceholder: { width: 120, height: 68, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  premiereBadge: { position: 'absolute', top: 4, left: 4, flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  premiereBadgeText: { fontSize: 9, color: '#FFD700', fontWeight: FontWeights.bold },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4 },
  scheduleInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  scheduleDate: { fontSize: FontSizes.xs, color: Colors.text.muted },
  countdownBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(34, 197, 94, 0.1)', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  countdownUrgent: { backgroundColor: 'rgba(245, 158, 11, 0.15)' },
  countdownText: { fontSize: FontSizes.xs, color: Colors.status.success, fontWeight: FontWeights.semibold },
  countdownTextUrgent: { color: Colors.status.warning },
  cardActions: { position: 'absolute', top: Spacing.md, right: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  actionBtn: { padding: Spacing.xs },
  menuButton: { padding: Spacing.xs },
  dropdownMenu: { position: 'absolute', top: 40, right: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, zIndex: 100, minWidth: 160, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  dropdownItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  dropdownText: { fontSize: FontSizes.sm, color: Colors.text.primary },
  dropdownDelete: { marginTop: 2, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.muted },
});
