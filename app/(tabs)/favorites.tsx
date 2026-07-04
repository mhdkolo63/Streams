import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Film, ArrowRight, Search, SortAsc, SortDesc, Grid, List, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

type SortOption = 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'most_viewed';

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [favorites, setFavorites] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const fetchFavorites = useCallback(async () => {
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
        const videos = data
          .filter((item) => item.videos && !Array.isArray(item.videos))
          .map((item) => ({
            video: item.videos as unknown as Video,
            addedAt: item.created_at,
          }));

        // Sort and filter
        let processed = videos.map(v => v.video);

        setFavorites(processed);
      }
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('Failed to load favorites', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  // Subscribe to changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('favorites-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favorites', filter: `user_id=eq.${user.id}` }, () => fetchFavorites())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchFavorites]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavorites();
    setRefreshing(false);
  }, [fetchFavorites]);

  // Filter and sort favorites
  const filteredAndSortedFavorites = useMemo(() => {
    let result = [...favorites];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((video) =>
        video.title.toLowerCase().includes(query) ||
        (video.description?.toLowerCase().includes(query)) ||
        (video.genre?.toLowerCase().includes(query))
      );
    }

    // Sort
    switch (sortBy) {
      case 'oldest':
        // Already sorted by newest, reverse for oldest
        result = result.reverse();
        break;
      case 'title_asc':
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'title_desc':
        result.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'most_viewed':
        result.sort((a, b) => b.views_count - a.views_count);
        break;
      default:
        // newest - already sorted
        break;
    }

    return result;
  }, [favorites, searchQuery, sortBy]);

  const removeFavorite = async (videoId: string) => {
    if (!user) return;
    // Optimistic UI - remove from list immediately
    setFavorites(prev => prev.filter(v => v.id !== videoId));
    toast.info('Removed from My List');
    try {
      await supabase.from('favorites').delete().eq('video_id', videoId).eq('user_id', user.id);
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('Failed to remove', 'Please try again');
      // Revert on failure - refetch
      fetchFavorites();
    }
  };

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'title_asc', label: 'Title A-Z' },
    { value: 'title_desc', label: 'Title Z-A' },
    { value: 'most_viewed', label: 'Most Viewed' },
  ];

  const getSortLabel = () => {
    return sortOptions.find(o => o.value === sortBy)?.label || 'Sort';
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Heart size={24} color={Colors.primary} />
          <Text style={styles.title}>My List</Text>
        </View>
        <EmptyState
          type="favorites"
          icon={<Heart size={64} color={Colors.text.muted} />}
          title="Sign in to use My List"
          message="Keep track of your favorite movies and shows by signing in."
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
          <Heart size={24} color={Colors.primary} />
          <Text style={styles.title}>My List</Text>
        </View>
        <View style={styles.gridContainer}>
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Heart size={24} color={Colors.primary} fill={Colors.primary} />
          <Text style={styles.title}>My List</Text>
          <Text style={styles.count}>{favorites.length}</Text>
        </View>
      </View>

      {/* Search and Sort Bar */}
      {favorites.length > 0 && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.toolbar}>
          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.text.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search your list..."
              placeholderTextColor={Colors.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <X size={16} color={Colors.text.muted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Sort and View Toggle */}
          <View style={styles.toolbarActions}>
            <TouchableOpacity
              style={styles.sortButton}
              onPress={() => setShowSortMenu(!showSortMenu)}
            >
              {sortBy.includes('asc') || sortBy === 'title_asc' ? (
                <SortAsc size={18} color={Colors.text.primary} />
              ) : (
                <SortDesc size={18} color={Colors.text.primary} />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.viewToggle}
              onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            >
              {viewMode === 'grid' ? (
                <List size={18} color={Colors.text.primary} />
              ) : (
                <Grid size={18} color={Colors.text.primary} />
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}

      {/* Sort Menu */}
      {showSortMenu && (
        <Animated.View entering={FadeInDown.duration(200)} style={styles.sortMenu}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.sortOption, sortBy === option.value && styles.sortOptionActive]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortMenu(false);
              }}
            >
              <Text style={[styles.sortOptionText, sortBy === option.value && styles.sortOptionTextActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Content */}
      {favorites.length === 0 ? (
        <EmptyState
          type="favorites"
          icon={<Heart size={64} color={Colors.text.muted} />}
          title="Your list is empty"
          message="Add movies and shows to watch later by tapping the heart icon."
          onAction={() => router.push('/')}
          actionLabel="Browse Videos"
        />
      ) : filteredAndSortedFavorites.length === 0 ? (
        <EmptyState
          type="custom"
          icon={<Search size={64} color={Colors.text.muted} />}
          title="No results found"
          message={`No videos in your list match "${searchQuery}"`}
          onAction={() => setSearchQuery('')}
          actionLabel="Clear Search"
        />
      ) : (
        <FlatList
          data={filteredAndSortedFavorites}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? 2 : 1}
          key={viewMode}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridColumn : undefined}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeIn.delay(index * 30).duration(200)} style={viewMode === 'grid' ? styles.gridItem : styles.listItem}>
              {viewMode === 'grid' ? (
                <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="medium" />
              ) : (
                <TouchableOpacity
                  style={styles.listCard}
                  onPress={() => router.push(`/video/${item.id}`)}
                  activeOpacity={0.8}
                >
                  <VideoCard video={item} onPress={() => router.push(`/video/${item.id}`)} size="large" showDetails={false} />
                  <View style={styles.listCardContent}>
                    <Text style={styles.listCardTitle} numberOfLines={2}>{item.title}</Text>
                    <View style={styles.listCardMeta}>
                      {item.release_year && <Text style={styles.listCardMetaText}>{item.release_year}</Text>}
                      {item.genre && <Text style={styles.listCardMetaText}>{item.genre}</Text>}
                    </View>
                    <TouchableOpacity
                      style={styles.listCardRemove}
                      onPress={() => removeFavorite(item.id)}
                    >
                      <X size={16} color={Colors.text.muted} />
                      <Text style={styles.listCardRemoveText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              )}
            </Animated.View>
          )}
          contentContainerStyle={viewMode === 'grid' ? styles.gridContent : styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  count: { fontSize: FontSizes.md, color: Colors.text.secondary },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, padding: 0 },
  toolbarActions: { flexDirection: 'row', gap: Spacing.sm },
  sortButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewToggle: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortMenu: {
    position: 'absolute',
    top: 120,
    right: Spacing.lg + 44 + Spacing.md + 44,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    minWidth: 160,
    borderWidth: 1,
    borderColor: Colors.border,
    zIndex: 10,
    elevation: 5,
  },
  sortOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  sortOptionActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  sortOptionText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  sortOptionTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md },
  gridContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  gridColumn: { justifyContent: 'space-between' },
  gridItem: { width: '48%', marginBottom: Spacing.md },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  listItem: { marginBottom: Spacing.md },
  listCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    alignItems: 'center',
  },
  listCardContent: { flex: 1, padding: Spacing.md },
  listCardTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  listCardMeta: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  listCardMetaText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  listCardRemove: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  listCardRemoveText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  emptyTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  emptySubtitle: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.lg },
  authButton: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl },
  browseButton: { marginTop: Spacing.md, paddingHorizontal: Spacing.xl },
});
