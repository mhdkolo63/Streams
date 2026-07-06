import React, { memo, useRef, useCallback, useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity, Platform, NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ChevronRight, ChevronLeft, TrendingUp, Flame, Star, Sparkles, Film, Clock, Heart, Play } from 'lucide-react-native';
import { Colors, FontSizes, FontWeights, Spacing, BorderRadius } from '@/constants/theme';
import { Video } from '@/lib/supabase';
import { VideoCard } from './VideoCard';
import { VideoCardSkeleton } from './Skeleton';
import { useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

interface VideoRowProps {
  title: string;
  videos?: Video[];
  loading?: boolean;
  onSeeAll?: () => void;
  showProgress?: boolean;
  progressMap?: Record<string, number>;
  size?: 'small' | 'medium' | 'large';
  icon?: typeof TrendingUp;
  emptyMessage?: string;
}

function VideoRowComponent({
  title,
  videos = [],
  loading,
  onSeeAll,
  showProgress,
  progressMap,
  size = 'medium',
  icon,
  emptyMessage,
}: VideoRowProps) {
  const router = useRouter();
  const listRef = useRef<FlatList<Video>>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const handleVideoPress = useCallback((video: Video) => {
    router.push(`/video/${video.id}`);
  }, [router]);

  const IconComponent = icon;

  const checkScrollButtons = useCallback((offset: number, contentWidth: number, layoutWidth: number) => {
    if (contentWidth <= layoutWidth) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(offset > 8);
    setCanScrollRight(offset < contentWidth - layoutWidth - 8);
  }, []);

  const scrollOffsetRef = useRef(0);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    scrollOffsetRef.current = contentOffset.x;
    checkScrollButtons(contentOffset.x, contentSize.width, layoutMeasurement.width);
  }, [checkScrollButtons]);

  useEffect(() => {
    // Check initial scroll state after data loads
    if (videos.length > 0 && !loading) {
      setTimeout(() => {
        if (listRef.current) {
          // @ts-ignore - getScrollResponder is available on FlatList
          listRef.current?.getScrollResponder()?.scrollTo?.({ x: 0, y: 0, animated: false });
        }
        setCanScrollRight(videos.length > getVisibleCount());
        setCanScrollLeft(false);
      }, 100);
    }
  }, [videos, loading]);

  const getVisibleCount = () => {
    const cardWidth = size === 'small' ? Math.min(width * 0.3, 160) : size === 'large' ? Math.min(width - 48, 400) : Math.min(width * 0.4, 240);
    return Math.floor(width / (cardWidth + Spacing.md));
  };

  const scrollByAmount = useCallback((direction: 'left' | 'right') => {
    if (!listRef.current) return;
    const cardWidth = size === 'small' ? Math.min(width * 0.3, 160) : size === 'large' ? Math.min(width - 48, 400) : Math.min(width * 0.4, 240);
    const scrollAmount = (cardWidth + Spacing.md) * 3;
    const currentOffset = scrollOffsetRef.current;
    const newOffset = direction === 'left' ? Math.max(0, currentOffset - scrollAmount) : currentOffset + scrollAmount;
    listRef.current?.scrollToOffset({ offset: newOffset, animated: true });
  }, [size]);

  // Mouse wheel horizontal scroll on web
  const handleWheel = useCallback((e: any) => {
    if (Platform.OS !== 'web') return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      const direction = e.deltaY > 0 ? 'right' : 'left';
      scrollByAmount(direction);
    }
  }, [scrollByAmount]);

  if (loading) {
    return (
      <Animated.View entering={FadeIn.duration(300)} style={styles.container}>
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonTitle} />
          </View>
        </View>
        <FlatList
          horizontal
          data={[1, 2, 3, 4, 5]}
          keyExtractor={(item) => item.toString()}
          renderItem={() => <VideoCardSkeleton size={size} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          scrollEnabled={false}
        />
      </Animated.View>
    );
  }

  if (videos.length === 0) {
    if (emptyMessage) {
      return (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.container}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              {IconComponent && (
                <View style={styles.iconContainer}>
                  <IconComponent size={18} color={Colors.primary} />
                </View>
              )}
              <Text style={styles.title}>{title}</Text>
            </View>
          </View>
          <View style={styles.emptyState}>
            <Play size={32} color={Colors.text.muted} />
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        </Animated.View>
      );
    }
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.delay(50).duration(300).springify()} style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          {IconComponent && (
            <View style={styles.iconContainer}>
              <IconComponent size={18} color={Colors.primary} />
            </View>
          )}
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.count}>{videos.length}</Text>
        </View>
        {onSeeAll && (
          <TouchableOpacity style={styles.seeAllButton} onPress={onSeeAll} activeOpacity={0.7}>
            <Text style={styles.seeAllText}>See All</Text>
            <ChevronRight size={16} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.scrollContainer}>
        {/* Left arrow */}
        {canScrollLeft && Platform.OS === 'web' && (
          <TouchableOpacity
            style={[styles.scrollArrow, styles.scrollArrowLeft]}
            onPress={() => scrollByAmount('left')}
            activeOpacity={0.8}
          >
            <ChevronLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        )}

        <FlatList
          ref={listRef}
          horizontal
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <VideoCard
              video={item}
              onPress={() => handleVideoPress(item)}
              size={size}
              showProgress={showProgress}
              progress={progressMap?.[item.id]}
              index={index}
            />
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          {...(Platform.OS === 'web' ? { onScrollToOverflow: handleWheel as any } : {})}
        />

        {/* Right arrow */}
        {canScrollRight && Platform.OS === 'web' && (
          <TouchableOpacity
            style={[styles.scrollArrow, styles.scrollArrowRight]}
            onPress={() => scrollByAmount('right')}
            activeOpacity={0.8}
          >
            <ChevronRight size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
}

export const VideoRow = memo(VideoRowComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
  },
  count: {
    color: Colors.text.muted,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  seeAllText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
  },
  list: {
    paddingHorizontal: Spacing.lg,
  },
  scrollContainer: {
    position: 'relative',
  },
  scrollArrow: {
    position: 'absolute',
    top: '50%',
    marginTop: -24,
    width: 40,
    height: 48,
    backgroundColor: 'rgba(11, 11, 11, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    zIndex: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scrollArrowLeft: {
    left: 0,
  },
  scrollArrowRight: {
    right: 0,
  },
  skeletonIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.tertiary,
  },
  skeletonTitle: {
    width: 120,
    height: 20,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.tertiary,
  },
  emptyState: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.text.muted,
    fontSize: FontSizes.md,
    textAlign: 'center',
  },
});
