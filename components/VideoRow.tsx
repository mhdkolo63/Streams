import React, { memo } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { ChevronRight, TrendingUp, Flame, Star, Sparkles, Film, Clock, Heart } from 'lucide-react-native';
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
}

const iconMap: Record<string, any> = {
  TrendingUp,
  Flame,
  Star,
  Sparkles,
  Film,
  Clock,
  Heart,
};

function VideoRowComponent({
  title,
  videos = [],
  loading,
  onSeeAll,
  showProgress,
  progressMap,
  size = 'medium',
  icon,
}: VideoRowProps) {
  const router = useRouter();

  const handleVideoPress = (video: Video) => {
    router.push(`/video/${video.id}`);
  };

  const IconComponent = icon;

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
        />
      </Animated.View>
    );
  }

  if (videos.length === 0) {
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
      <FlatList
        horizontal
        data={videos}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeIn.delay(index * 50).duration(300)}>
            <VideoCard
              video={item}
              onPress={() => handleVideoPress(item)}
              size={size}
              showProgress={showProgress}
              progress={progressMap?.[item.id]}
            />
          </Animated.View>
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        snapToInterval={size === 'small' ? width * 0.32 : size === 'large' ? width - 32 : width * 0.42}
        decelerationRate="fast"
      />
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
});
