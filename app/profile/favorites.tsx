import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Heart, Search, SortAsc, SortDesc, Grid, List, X } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { SubPageHeader } from '@/components/SubPageHeader';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

type SortOption = 'newest' | 'oldest' | 'title_asc' | 'title_desc' | 'most_viewed';

export default function FavoritesSubScreen() {
  useAuthGuard(true);
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
          .map((item) => item.videos as unknown as Video);
        setFavorites(videos);
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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchFavorites();
    setRefreshing(false);
  }, [fetchFavorites]);

  const filteredAndSortedFavorites = useMemo(() => {
    let result = [...favorites];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((video) =>
        video.title.toLowerCase().includes(query) ||
        (video.description?.toLowerCase().includes(query)) ||
        (video.genre?.toLowerCase().includes(query))
      );
    }

    switch (sortBy) {
      case 'oldest':
        result.reverse();
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
        break;
    }

    return result;
  }, [favorites, searchQuery, sortBy]);

  const sortOptions: { value: SortOption; label: string }[] = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'title_asc', label: 'Title A-Z' },
    { value: 'title_desc', label: 'Title Z-A' },
    { value: 'most_viewed', label: 'Most Viewed' },
  ];

  if (loading) {
    return (
      <View style={styles.container}>
        <SubPageHeader title="Favorites" subtitle="Your saved videos" />
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
      <SubPageHeader title="Favorites" subtitle={`${favorites.length} saved videos`} />

      {favorites.length > 0 && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.toolbar}>
          <View style={styles.searchContainer}>
            <Search size={18} color={Colors.text.muted} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search favorites..."
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

      {favorites.length === 0 ? (
        <EmptyState
          type="favorites"
          icon={<Heart size={64} color={Colors.text.muted} />}
          title="No favorites yet"
          message="Tap the heart icon on any video to add it to your favorites."
          onAction={() => router.push('/')}
          actionLabel="Browse Videos"
        />
      ) : filteredAndSortedFavorites.length === 0 ? (
        <EmptyState
          type="custom"
          icon={<Search size={64} color={Colors.text.muted} />}
          title="No results found"
          message={`No favorites match "${searchQuery}"`}
          onAction={() => setSearchQuery('')}
          actionLabel="Clear Search"
        />
      ) : (
        <FlatList
          data={filteredAndSortedFavorites}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <VideoCard video={item} size="medium" onPress={() => router.push(`/player/${item.id}`)} />}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },
  gridItem: { width: (width - Spacing.md * 3) / 2 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.input,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    height: 40,
  },
  searchIcon: { marginRight: Spacing.xs },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, padding: 0 },
  toolbarActions: { flexDirection: 'row', gap: Spacing.xs },
  sortButton: { padding: Spacing.sm, backgroundColor: Colors.input, borderRadius: BorderRadius.full },
  viewToggle: { padding: Spacing.sm, backgroundColor: Colors.input, borderRadius: BorderRadius.full },
  sortMenu: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  sortOption: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  sortOptionActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  sortOptionText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  sortOptionTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
});
