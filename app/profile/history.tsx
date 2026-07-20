import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Clock,
  Play,
  Trash2,
  Film,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react-native';
import Animated, { FadeInDown, FadeInUp, SlideOutRight, Layout } from 'react-native-reanimated';
import { supabase, Video, WatchHistory } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { SubPageHeader } from '@/components/SubPageHeader';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function HistorySubScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [watchHistory, setWatchHistory] = useState<(WatchHistory & { video?: Video })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchHistory = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('watch_history')
        .select('*, videos(*)')
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      if (data) {
        setWatchHistory(data as (WatchHistory & { video?: Video })[]);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
      toast.error('Failed to load history', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [fetchHistory]);

  const removeWatchHistory = async (historyId: string) => {
    try {
      await supabase.from('watch_history').delete().eq('id', historyId);
      setWatchHistory(prev => prev.filter(h => h.id !== historyId));
      toast.info('Removed from history');
    } catch (error) {
      console.error('Error removing from history:', error);
      toast.error('Failed to remove', 'Please try again');
    }
  };

  const clearAllHistory = async () => {
    if (!user) return;

    setClearing(true);
    try {
      await supabase.from('watch_history').delete().eq('user_id', user.id);
      setWatchHistory([]);
      setShowClearConfirm(false);
      toast.success('History cleared', 'All watch history has been deleted');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Failed to clear history', 'Please try again');
    } finally {
      setClearing(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: (WatchHistory & { video?: Video })[] } = {};

    watchHistory.forEach((item) => {
      const date = new Date(item.last_watched_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

      let groupKey: string;
      if (diffDays === 0) groupKey = 'Today';
      else if (diffDays === 1) groupKey = 'Yesterday';
      else if (diffDays < 7) groupKey = 'This Week';
      else if (diffDays < 30) groupKey = 'This Month';
      else groupKey = 'Older';

      if (!groups[groupKey]) groups[groupKey] = [];
      groups[groupKey].push(item);
    });

    return groups;
  }, [watchHistory]);

  if (loading) {
    return (
      <View style={styles.container}>
        <SubPageHeader title="Watch History" subtitle="Videos you've watched" />
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.skeletonItem}>
              <View style={styles.skeletonThumbnail} />
              <View style={styles.skeletonInfo}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonMeta} />
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (watchHistory.length === 0) {
    return (
      <View style={styles.container}>
        <SubPageHeader title="Watch History" subtitle="Videos you've watched" />
        <EmptyState
          type="history"
          icon={<Film size={64} color={Colors.text.muted} />}
          title="No watch history"
          message="Start watching videos to build your history. Your progress will be saved automatically."
          onAction={() => router.push('/')}
          actionLabel="Start Watching"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubPageHeader
        title="Watch History"
        subtitle={`${watchHistory.length} videos`}
        rightElement={
          <TouchableOpacity style={styles.clearButton} onPress={() => setShowClearConfirm(true)}>
            <Trash2 size={18} color={Colors.status.error} />
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        }
      />

      {showClearConfirm && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.modalOverlay}>
          <Animated.View entering={FadeInUp.duration(200)} style={styles.modalContent}>
            <View style={styles.modalIcon}>
              <AlertTriangle size={32} color={Colors.status.warning} />
            </View>
            <Text style={styles.modalTitle}>Clear all history?</Text>
            <Text style={styles.modalMessage}>
              This will permanently delete your entire watch history. This action cannot be undone.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowClearConfirm(false)}
                disabled={clearing}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, clearing && styles.modalButtonDisabled]}
                onPress={clearAllHistory}
                disabled={clearing}
              >
                <Text style={styles.modalConfirmText}>{clearing ? 'Clearing...' : 'Clear All'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Animated.View>
      )}

      <FlatList
        data={Object.entries(groupedHistory)}
        keyExtractor={([group]) => group}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        renderItem={({ item: [group, items] }) => (
          <View style={styles.group}>
            <Text style={styles.groupTitle}>{group}</Text>
            {items.map((historyItem, index) => (
              <Animated.View
                key={historyItem.id}
                entering={FadeInDown.delay(index * 30).duration(300)}
                layout={Layout.springify()}
                exiting={SlideOutRight.duration(200)}
              >
                <TouchableOpacity
                  style={styles.historyItem}
                  onPress={() => historyItem.video && router.push(`/player/${historyItem.video_id}`)}
                  activeOpacity={0.7}
                >
                  <View style={styles.thumbnailContainer}>
                    {historyItem.video?.thumbnail_url ? (
                      <Image source={{ uri: historyItem.video.thumbnail_url }} style={styles.thumbnail} />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <Film size={24} color={Colors.text.muted} />
                      </View>
                    )}
                    {historyItem.video && historyItem.video.duration > 0 && (
                      <View style={styles.durationBadge}>
                        <Text style={styles.durationText}>
                          {formatDuration(historyItem.video.duration)}
                        </Text>
                      </View>
                    )}
                    {historyItem.progress > 0 && historyItem.video && historyItem.video.duration > 0 && (
                      <View style={styles.progressOverlay}>
                        <View style={[styles.progressBar, { width: `${Math.min(100, (historyItem.progress / historyItem.video.duration) * 100)}%` }]} />
                      </View>
                    )}
                  </View>

                  <View style={styles.historyInfo}>
                    <Text style={styles.historyTitle} numberOfLines={2}>
                      {historyItem.video?.title || 'Unknown video'}
                    </Text>
                    <View style={styles.historyMeta}>
                      <Clock size={12} color={Colors.text.muted} />
                      <Text style={styles.historyTime}>{formatTimeAgo(historyItem.last_watched_at)}</Text>
                      {historyItem.completed && (
                        <View style={styles.completedBadge}>
                          <CheckCircle size={12} color={Colors.status.success} />
                          <Text style={styles.completedText}>Watched</Text>
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeWatchHistory(historyItem.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Trash2 size={18} color={Colors.text.muted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.md,
  },
  clearButtonText: { fontSize: FontSizes.sm, color: Colors.status.error, fontWeight: FontWeights.medium },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  group: { marginBottom: Spacing.lg },
  groupTitle: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.bold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumbnailContainer: { position: 'relative' },
  thumbnail: { width: 120, height: 68, borderRadius: BorderRadius.md },
  thumbnailPlaceholder: {
    width: 120,
    height: 68,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: { fontSize: 10, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  progressOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  progressBar: { height: '100%', backgroundColor: Colors.primary },
  historyInfo: { flex: 1, justifyContent: 'center' },
  historyTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4, lineHeight: 18 },
  historyMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  historyTime: { fontSize: FontSizes.xs, color: Colors.text.muted },
  completedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: Spacing.xs },
  completedText: { fontSize: FontSizes.xs, color: Colors.status.success, fontWeight: FontWeights.medium },
  removeButton: { padding: Spacing.xs, alignSelf: 'center' },
  skeletonContainer: { padding: Spacing.lg },
  skeletonItem: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  skeletonThumbnail: { width: 120, height: 68, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary },
  skeletonInfo: { flex: 1, gap: Spacing.sm },
  skeletonTitle: { width: '80%', height: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  skeletonMeta: { width: '50%', height: 12, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginHorizontal: Spacing.xl,
    width: width - 64,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalIcon: { alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, textAlign: 'center', marginBottom: Spacing.sm },
  modalMessage: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 22 },
  modalButtons: { flexDirection: 'row', gap: Spacing.md },
  modalCancelButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, alignItems: 'center' },
  modalCancelText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  modalConfirmButton: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, backgroundColor: Colors.status.error, alignItems: 'center' },
  modalButtonDisabled: { opacity: 0.5 },
  modalConfirmText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
});
