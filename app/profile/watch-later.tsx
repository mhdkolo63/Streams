import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bookmark,
  Film,
  Search,
  X,
  Trash2,
  CheckSquare,
  Square,
  ChevronDown,
  ArrowUpDown,
  Clock,
  Calendar,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { SubPageHeader } from '@/components/SubPageHeader';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

type SortOption = 'recent' | 'oldest' | 'title' | 'duration';

interface WatchLaterItem {
  video_id: string;
  created_at: string;
  videos: Video;
}

export default function WatchLaterScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<WatchLaterItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchWatchLater = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select('video_id, created_at, videos(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const fetched = data
          .filter((item) => item.videos && !Array.isArray(item.videos))
          .map((item) => item as unknown as WatchLaterItem);
        setItems(fetched);
      }
    } catch (error) {
      console.error('Error fetching watch later:', error);
      toast.error('Failed to load', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchWatchLater();
  }, [fetchWatchLater]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchWatchLater();
    setRefreshing(false);
  }, [fetchWatchLater]);

  const filteredAndSorted = useMemo(() => {
    let result = [...items];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item) => item.videos?.title?.toLowerCase().includes(q));
    }

    switch (sortBy) {
      case 'recent':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        result.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'title':
        result.sort((a, b) => (a.videos?.title || '').localeCompare(b.videos?.title || ''));
        break;
      case 'duration':
        result.sort((a, b) => (b.videos?.duration || 0) - (a.videos?.duration || 0));
        break;
    }

    return result;
  }, [items, searchQuery, sortBy]);

  const videos = filteredAndSorted.map((item) => item.videos).filter(Boolean);

  const toggleSelect = (videoId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(videoId)) {
        next.delete(videoId);
      } else {
        next.add(videoId);
      }
      return next;
    });
  };

  const handleRemoveSelected = async () => {
    if (!user || selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await supabase.from('favorites').delete().eq('user_id', user.id).in('video_id', ids);
      setItems((prev) => prev.filter((item) => !selectedIds.has(item.video_id)));
      setSelectedIds(new Set());
      setMultiSelectMode(false);
      toast.success(`Removed ${ids.length} video${ids.length > 1 ? 's' : ''}`);
    } catch (error) {
      toast.error('Failed to remove videos', 'Please try again');
    }
  };

  const handleClearAll = () => {
    if (items.length === 0) return;
    Alert.alert('Clear Watch Later', 'Remove all saved videos?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          try {
            await supabase.from('favorites').delete().eq('user_id', user.id);
            setItems([]);
            toast.success('Watch later cleared');
          } catch (error) {
            toast.error('Failed to clear', 'Please try again');
          }
        },
      },
    ]);
  };

  const sortLabels: Record<SortOption, string> = {
    recent: 'Most Recent',
    oldest: 'Oldest First',
    title: 'Title (A-Z)',
    duration: 'Longest First',
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <SubPageHeader title="Watch Later" subtitle="Your saved playlist" />
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.gridItem}>
              <VideoCardSkeleton size="medium" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubPageHeader
        title="Watch Later"
        subtitle={`${items.length} video${items.length !== 1 ? 's' : ''} queued`}
      />

      {/* Toolbar */}
      {items.length > 0 && (
        <View style={styles.toolbar}>
          {showSearch && (
            <View style={styles.searchWrap}>
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search saved videos..."
                leftIcon={<Search size={16} color={Colors.text.muted} />}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}
          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setShowSearch(!showSearch)}
            >
              {showSearch ? <X size={18} color={Colors.text.secondary} /> : <Search size={18} color={Colors.text.secondary} />}
              <Text style={styles.toolBtnText}>{showSearch ? 'Close' : 'Search'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              <ArrowUpDown size={18} color={Colors.text.secondary} />
              <Text style={styles.toolBtnText}>{sortLabels[sortBy]}</Text>
              <ChevronDown size={14} color={Colors.text.muted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={() => {
                setMultiSelectMode(!multiSelectMode);
                setSelectedIds(new Set());
              }}
            >
              {multiSelectMode ? <CheckSquare size={18} color={Colors.primary} /> : <Square size={18} color={Colors.text.secondary} />}
              <Text style={styles.toolBtnText}>Select</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.toolBtn} onPress={handleClearAll}>
              <Trash2 size={18} color={Colors.status.error} />
              <Text style={styles.toolBtnText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {/* Sort Dropdown */}
          {showSortMenu && (
            <View style={styles.sortMenu}>
              {(Object.keys(sortLabels) as SortOption[]).map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[styles.sortItem, sortBy === opt && styles.sortItemActive]}
                  onPress={() => {
                    setSortBy(opt);
                    setShowSortMenu(false);
                  }}
                >
                  <Text style={[styles.sortItemText, sortBy === opt && styles.sortItemTextActive]}>
                    {sortLabels[opt]}
                  </Text>
                  {sortBy === opt && <Calendar size={14} color={Colors.primary} />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Multi-select bar */}
      {multiSelectMode && selectedIds.size > 0 && (
        <View style={styles.multiSelectBar}>
          <Text style={styles.multiSelectText}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={handleRemoveSelected}>
            <Text style={styles.multiSelectRemove}>Remove Selected</Text>
          </TouchableOpacity>
        </View>
      )}

      {items.length === 0 ? (
        <EmptyState
          type="custom"
          icon={<Bookmark size={64} color={Colors.text.muted} />}
          title="Your watch later list is empty"
          message="Save videos to watch them later. Tap the bookmark icon on any video."
          onAction={() => router.push('/')}
          actionLabel="Browse Videos"
        />
      ) : filteredAndSorted.length === 0 ? (
        <View style={styles.noResults}>
          <Search size={48} color={Colors.text.muted} />
          <Text style={styles.noResultsText}>No videos match "{searchQuery}"</Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
              {multiSelectMode ? (
                <TouchableOpacity
                  style={styles.multiSelectCard}
                  onPress={() => toggleSelect(item.id)}
                  activeOpacity={0.7}
                >
                  {selectedIds.has(item.id) ? (
                    <CheckSquare size={24} color={Colors.primary} />
                  ) : (
                    <Square size={24} color={Colors.text.muted} />
                  )}
                  <VideoCard
                    video={item}
                    size="medium"
                    onPress={() => toggleSelect(item.id)}
                  />
                </TouchableOpacity>
              ) : (
                <VideoCard video={item} size="medium" onPress={() => router.push(`/player/${item.id}`)} />
              )}
            </Animated.View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.md },
  gridItem: { width: (width - Spacing.md * 3) / 2 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  toolbar: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, gap: Spacing.sm },
  searchWrap: { marginBottom: Spacing.xs },
  toolbarActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  toolBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.card, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border },
  toolBtnText: { fontSize: FontSizes.xs, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  sortMenu: { backgroundColor: Colors.card, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, gap: 2 },
  sortItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm },
  sortItemActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  sortItemText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  sortItemTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  multiSelectBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(229, 9, 20, 0.1)', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderRadius: BorderRadius.md },
  multiSelectText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  multiSelectRemove: { fontSize: FontSizes.sm, color: Colors.status.error, fontWeight: FontWeights.semibold },
  multiSelectCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  noResults: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.md, paddingBottom: Spacing.xxl },
  noResultsText: { fontSize: FontSizes.md, color: Colors.text.muted, textAlign: 'center' },
});
