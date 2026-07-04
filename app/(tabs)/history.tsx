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
  ChevronRight,
  MoreVertical,
  CheckCircle,
  X,
  AlertTriangle,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideOutRight, Layout } from 'react-native-reanimated';
import { supabase, Video, WatchHistory } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { EmptyState, EmptyHistory } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function HistoryScreen() {
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
      console.error('Error fetching watch history:', error);
      toast.error('Failed to load history', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // Subscribe to changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('history-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'watch_history', filter: `user_id=eq.${user.id}` }, () => fetchHistory())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchHistory]);

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

  const handleClearAll = () => {
    setShowClearConfirm(true);
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

  // Group history by date
  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: (WatchHistory & { video?: Video })[] } = {};

    watchHistory.forEach((item) => {
      const date = new Date(item.last_watched_at);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

      let groupKey: string;
      if (diffDays === 0) {
        groupKey = 'Today';
      } else if (diffDays === 1) {
        groupKey = 'Yesterday';
      } else if (diffDays < 7) {
        groupKey = 'This Week';
      } else if (diffDays < 30) {
        groupKey = 'This Month';
      } else {
        groupKey = 'Older';
      }

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });

    return groups;
  }, [watchHistory]);

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Clock size={24} color={Colors.primary} />
          <Text style={styles.title}>Watch History</Text>
        </View>
        <EmptyState
          type="history"
          icon={<Clock size={64} color={Colors.text.muted} />}
          title="Sign in to view history"
          message="Keep track of what you've watched by signing in."
          onAction={() => router.push('/auth/login')}
          actionLabel="Sign In"
        />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Clock size={24} color={Colors.primary} />
          <Text style={styles.title}>Watch History</Text>
        </View>
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
        <View style={styles.header}>
          <Clock size={24} color={Colors.primary} />
          <Text style={styles.title}>Watch History</Text>
        </View>
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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Clock size={24} color={Colors.primary} />
          <Text style={styles.title}>Watch History</Text>
          <Text style={styles.count}>{watchHistory.length} videos</Text>
        </View>
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClearAll}
        >
          <Trash2 size={18} color={Colors.status.error} />
          <Text style={styles.clearButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Clear Confirmation Modal */}
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
        renderItem={({ item: [group, items], index }) => (
          <Animated.View entering={FadeIn.delay(index * 50).duration(200)} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text style={styles.groupTitle}>{group}</Text>
              <Text style={styles.groupCount}>{items.length}</Text>
            </View>
            {items.map((item, itemIndex) => {
              const video = item.video;
              if (!video) return null;

              const progress = video.duration > 0 ? Math.min(100, (item.progress / video.duration) * 100) : 0;
              const isCompleted = item.completed || item.progress >= video.duration;

              return (
                <Animated.View
                  key={item.id}
                  layout={Layout.springify()}
                  exiting={SlideOutRight.duration(200)}
                  style={styles.historyItem}
                >
                  <TouchableOpacity
                    style={styles.historyContent}
                    onPress={() => router.push(`/video/${video.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.thumbnailContainer}>
                      <Image
                        source={{
                          uri: video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=200&h=120&fit=crop',
                        }}
                        style={styles.thumbnail}
                      />
                      <View style={styles.progressContainer}>
                        <View style={styles.progressBar}>
                          <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                      </View>
                      <View style={styles.playOverlay}>
                        <Play size={24} color={Colors.text.primary} fill={Colors.text.primary} />
                      </View>
                      <View style={styles.timestampBadge}>
                        <Text style={styles.timestampText}>{formatTimeAgo(item.last_watched_at)}</Text>
                      </View>
                      {isCompleted && (
                        <View style={styles.completedBadge}>
                          <CheckCircle size={14} color={Colors.status.success} />
                        </View>
                      )}
                    </View>

                    <View style={styles.info}>
                      <Text style={styles.videoTitle} numberOfLines={2}>{video.title}</Text>
                      <Text style={styles.videoProgress}>
                        {formatDuration(item.progress)} / {formatDuration(video.duration)}
                      </Text>
                      {progress > 0 && progress < 95 && (
                        <TouchableOpacity
                          style={styles.continueButton}
                          onPress={() => router.push(`/player/${video.id}`)}
                        >
                          <Play size={12} color={Colors.primary} />
                          <Text style={styles.continueText}>Continue</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => removeWatchHistory(item.id)}
                    style={styles.removeButton}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <X size={18} color={Colors.text.muted} />
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  count: { fontSize: FontSizes.lg, color: Colors.text.secondary },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: BorderRadius.md,
  },
  clearButtonText: { fontSize: FontSizes.sm, color: Colors.status.error, fontWeight: FontWeights.medium },
  group: { marginBottom: Spacing.lg },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  groupTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  groupCount: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  listContent: { paddingBottom: Spacing.xxl },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    padding: Spacing.sm,
    overflow: 'hidden',
  },
  historyContent: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumbnailContainer: {
    width: 100,
    height: 56,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: { width: '100%', height: '100%' },
  progressContainer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 2 },
  progressBar: { height: 3, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: BorderRadius.full, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.3)' },
  timestampBadge: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  timestampText: { fontSize: 10, color: Colors.text.primary },
  completedBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(34, 197, 94, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: { flex: 1, marginLeft: Spacing.md, paddingVertical: Spacing.xs },
  videoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs, lineHeight: 18 },
  videoProgress: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginBottom: Spacing.xs },
  continueButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  continueText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: FontWeights.semibold },
  removeButton: { padding: Spacing.sm, marginLeft: Spacing.xs },
  skeletonContainer: { padding: Spacing.lg },
  skeletonItem: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.md, gap: Spacing.md },
  skeletonThumbnail: { width: 100, height: 56, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary },
  skeletonInfo: { flex: 1, gap: Spacing.xs },
  skeletonTitle: { width: '80%', height: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  skeletonMeta: { width: '40%', height: 12, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  modalMessage: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.xl },
  modalButtons: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  modalCancelButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.tertiary,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.status.error,
    alignItems: 'center',
  },
  modalButtonDisabled: { opacity: 0.6 },
  modalConfirmText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
});
