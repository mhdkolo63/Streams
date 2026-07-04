import React, { memo, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  ZoomIn,
} from 'react-native-reanimated';
import { Play, Eye, Star, Clock } from 'lucide-react-native';
import { Colors, BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { Video } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface VideoCardProps {
  video: Video;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  progress?: number;
  showDetails?: boolean;
}

function VideoCardComponent({
  video,
  onPress,
  size = 'medium',
  showProgress,
  progress,
  showDetails = true,
}: VideoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);

  const getCardWidth = () => {
    switch (size) {
      case 'small':
        return width * 0.32;
      case 'large':
        return width - Spacing.lg * 2;
      default:
        return width * 0.42;
    }
  };

  const getImageHeight = () => {
    switch (size) {
      case 'small':
        return width * 0.19;
      case 'large':
        return width * 0.5;
      default:
        return width * 0.26;
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const handleImageLoad = () => {
    setImageLoaded(true);
    opacity.value = withTiming(1, { duration: 300 });
  };

  const duration = formatDuration(video.duration);

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, { width: getCardWidth() }, animatedStyle]}
      android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: false }}
    >
      <View style={[styles.thumbnailContainer, { height: getImageHeight() }]}>
        {!imageLoaded && <View style={styles.imagePlaceholder} />}
        <Animated.Image
          source={{
            uri: video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=400&h=225&fit=crop',
          }}
          style={[styles.thumbnail, imageAnimatedStyle]}
          resizeMode="cover"
          onLoad={handleImageLoad}
        />
        <Animated.View entering={ZoomIn.delay(100).duration(200)} style={styles.overlay}>
          <View style={styles.playButtonContainer}>
            <View style={styles.playButton}>
              <Play size={22} color={Colors.text.primary} fill={Colors.text.primary} />
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(150).duration(200)} style={styles.durationBadge}>
          <Text style={styles.durationText}>{duration}</Text>
        </Animated.View>

        {video.featured && (
          <Animated.View entering={FadeIn.delay(100).duration(200)} style={styles.featuredBadge}>
            <Star size={10} color={Colors.primary} fill={Colors.primary} />
            <Text style={styles.featuredText}>Featured</Text>
          </Animated.View>
        )}

        {video.trending && !video.featured && (
          <Animated.View entering={FadeIn.delay(100).duration(200)} style={styles.trendingBadge}>
            <Text style={styles.trendingText}>Trending</Text>
          </Animated.View>
        )}

        {showProgress && progress !== undefined && progress > 0 && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}
      </View>

      {showDetails && (
        <View style={styles.details}>
          <Text style={styles.title} numberOfLines={2}>
            {video.title}
          </Text>
          <View style={styles.metaRow}>
            {video.release_year && (
              <Text style={styles.meta}>{video.release_year}</Text>
            )}
            {video.release_year && video.genre && (
              <Text style={styles.metaDot}>·</Text>
            )}
            {video.genre && size !== 'small' && (
              <Text style={styles.meta} numberOfLines={1}>{video.genre}</Text>
            )}
          </View>
          {video.views_count > 0 && size !== 'small' && (
            <View style={styles.viewsContainer}>
              <Eye size={12} color={Colors.text.muted} />
              <Text style={styles.views}>{formatViews(video.views_count)} views</Text>
            </View>
          )}
        </View>
      )}
    </AnimatedPressable>
  );
}

export const VideoCard = memo(VideoCardComponent);

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1000000) {
    return `${(views / 1000000).toFixed(1)}M`;
  }
  if (views >= 1000) {
    return `${(views / 1000).toFixed(1)}K`;
  }
  return views.toString();
}

const styles = StyleSheet.create({
  container: {
    marginRight: Spacing.md,
  },
  thumbnailContainer: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.secondary,
    position: 'relative',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.tertiary,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonContainer: {
    opacity: 0.9,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  durationBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  featuredBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(229, 9, 20, 0.95)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featuredText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  trendingBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
  },
  trendingText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 4,
  },
  progressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  details: {
    paddingHorizontal: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  title: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    marginBottom: 2,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  meta: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
  },
  metaDot: {
    color: Colors.text.muted,
    fontSize: FontSizes.sm,
    marginHorizontal: 4,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  views: {
    color: Colors.text.muted,
    fontSize: FontSizes.xs,
  },
});
