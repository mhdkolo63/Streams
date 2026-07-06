import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Film, ChevronDown } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Video, Category } from '@/lib/supabase';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const NUM_COLUMNS = width > 768 ? 4 : width > 480 ? 3 : 2;
const CARD_GAP = Spacing.md;

type SortOption = 'newest' | 'oldest' | 'most_viewed' | 'alphabetical';

export default function CategoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();

  const [category, setCategory] = useState<Category | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const fetchData = useCallback(async () => {
    if (!slug) return;
    try {
      const { data: catData } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!catData) {
        setLoading(false);
        return;
      }

      setCategory(catData as Category);

      const { data: junctionData } = await supabase
        .from('video_categories')
        .select('videos(*)')
        .eq('category_id', catData.id)
        .limit(100);

      const categoryVideos = junctionData
        ?.filter((v) => v.videos && !Array.isArray(v.videos))
        .map((v) => v.videos as unknown as Video)
        .filter(v => v.status === 'published') || [];

      setVideos(categoryVideos);
    } catch (error) {
      console.error('Error fetching category data:', error);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const sortedVideos = (() => {
    const sorted = [...videos];
    switch (sortBy) {
      case 'newest':
        sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        sorted.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'most_viewed':
        sorted.sort((a, b) => b.views_count - a.views_count);
        break;
      case 'alphabetical':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  })();

  const handleVideoPress = useCallback((video: Video) => {
    router.push(`/video/${video.id}`);
  }, [router]);

  const renderVideo = ({ item, index }: { item: Video; index: number }) => (
    <View style={styles.cardWrapper}>
      <VideoCard video={item} onPress={() => handleVideoPress(item)} size="medium" index={index} />
    </View>
  );

  const sortLabels: Record<SortOption, string> = {
    newest: 'Newest',
    oldest: 'Oldest',
    most_viewed: 'Most Viewed',
    alphabetical: 'A-Z',
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.categoryIconContainer}>
            <Film size={20} color={Colors.primary} />
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.categoryName}>{category?.name || 'Category'}</Text>
            <Text style={styles.videoCount}>
              {loading ? 'Loading...' : `${videos.length} video${videos.length !== 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>
      </View>

      {/* Category Description */}
      {category?.description && (
        <View style={styles.descriptionContainer}>
          <Text style={styles.description}>{category.description}</Text>
        </View>
      )}

      {/* Sort Bar */}
      {!loading && videos.length > 0 && (
        <View style={styles.sortBar}>
          <TouchableOpacity style={styles.sortButton} onPress={() => setShowSortMenu(!showSortMenu)} activeOpacity={0.7}>
            <Text style={styles.sortLabel}>Sort: {sortLabels[sortBy]}</Text>
            <ChevronDown size={16} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Sort Dropdown */}
      {showSortMenu && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.sortDropdown}>
          {(Object.keys(sortLabels) as SortOption[]).map(opt => (
            <TouchableOpacity
              key={opt}
              style={[styles.sortOption, sortBy === opt && styles.sortOptionActive]}
              onPress={() => { setSortBy(opt); setShowSortMenu(false); }}
            >
              <Text style={[styles.sortOptionText, sortBy === opt && styles.sortOptionTextActive]}>
                {sortLabels[opt]}
              </Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Video Grid */}
      {loading ? (
        <View style={styles.gridContainer}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={styles.cardWrapper}>
              <VideoCardSkeleton size="medium" />
            </View>
          ))}
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.emptyState}>
          <Film size={48} color={Colors.text.muted} />
          <Text style={styles.emptyTitle}>No videos in this category</Text>
          <Text style={styles.emptySubtitle}>New uploads will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={sortedVideos}
          keyExtractor={item => item.id}
          renderItem={renderVideo}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const cardWidth = (width - Spacing.lg * 2 - CARD_GAP * (NUM_COLUMNS - 1)) / NUM_COLUMNS;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  backButton: { padding: Spacing.xs },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: { flex: 1 },
  categoryName: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  videoCount: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  descriptionContainer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  description: { fontSize: FontSizes.md, color: Colors.text.secondary, lineHeight: 22 },
  sortBar: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  sortLabel: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  sortDropdown: {
    marginHorizontal: Spacing.lg,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sortOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  sortOptionActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  sortOptionText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  sortOptionTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: CARD_GAP,
  },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  columnWrapper: { gap: CARD_GAP, marginBottom: CARD_GAP },
  cardWrapper: { width: cardWidth },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.md },
  emptyTitle: { fontSize: FontSizes.lg, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
  emptySubtitle: { fontSize: FontSizes.md, color: Colors.text.muted, textAlign: 'center' },
});
