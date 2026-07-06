import React, { memo, useState, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions, Pressable, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  FadeIn,
  ZoomIn,
  FadeOut,
} from 'react-native-reanimated';
import { Play, Eye, Clock, Film, Calendar, Heart } from 'lucide-react-native';
import { Colors, BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { Video } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CARD_ASPECT = 16 / 9;

interface VideoCardProps {
  video: Video;
  onPress: () => void;
  size?: 'small' | 'medium' | 'large';
  showProgress?: boolean;
  progress?: number;
  showDetails?: boolean;
  index?: number;
}

function VideoCardComponent({
  video,
  onPress,
  size = 'medium',
  showProgress,
  progress,
  showDetails = true,
  index = 0,
}: VideoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favAnimating, setFavAnimating] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const overlayOpacity = useSharedValue(0);
  const favScale = useSharedValue(1);

  const getCardWidth = () => {
    switch (size) {
      case 'small':
        return Math.min(width * 0.3, 160);
      case 'large':
        return Math.min(width - Spacing.lg * 2, 400);
      default:
        return Math.min(width * 0.4, 240);
    }
  };

  const cardWidth = getCardWidth();
  const imageHeight = cardWidth / CARD_ASPECT;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const handleHoverIn = () => {
    if (Platform.OS === 'web') {
      overlayOpacity.value = withTiming(1, { duration: 200 });
    }
  };

  const handleHoverOut = () => {
    if (Platform.OS === 'web') {
      overlayOpacity.value = withTiming(0, { duration: 200 });
    }
  };

  const imageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const hoverOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const favAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favScale.value }],
  }));

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    opacity.value = withTiming(1, { duration: 300 });
  }, []);

  const handleFavoritePress = useCallback((e: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    setIsFavorite(prev => !prev);
    setFavAnimating(true);
    favScale.value = withSpring(1.4, { damping: 8, stiffness: 200 }, () => {
      favScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    setTimeout(() => setFavAnimating(false), 600);
  }, []);

  const duration = formatDuration(video.duration);
  const uploadDate = video.created_at
    ? new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const thumbnailUri = video.thumbnail_url || `https://picsum.photos/seed/${video.id}/640/360`;

  return (
    <Animated.View entering={FadeIn.delay(Math.min(index * 40, 300)).duration(400)}>
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onHoverIn={handleHoverIn}
        onHoverOut={handleHoverOut}
        style={[styles.container, { width: cardWidth }, animatedStyle]}
        android_ripple={{ color: 'rgba(255,255,255,0.1)', borderless: false }}
      >
        <View style={[styles.thumbnailContainer, { height: imageHeight }]}>
          {!imageLoaded && <View style={styles.imagePlaceholder} />}
          <Animated.Image
            source={{ uri: thumbnailUri }}
            style={[styles.thumbnail, imageAnimatedStyle]}
            resizeMode="cover"
            onLoad={handleImageLoad}
          />

          {/* Always-visible subtle overlay */}
          <Animated.View entering={ZoomIn.delay(100).duration(200)} style={styles.overlay}>
            <View style={styles.playButtonContainer}>
              <View style={styles.playButton}>
                <Play size={size === 'small' ? 16 : 20} color={Colors.text.primary} fill={Colors.text.primary} />
              </View>
            </View>
          </Animated.View>

          {/* Hover overlay for web - shows larger play button + favorite */}
          {Platform.OS === 'web' && (
            <Animated.View style={[styles.hoverOverlay, hoverOverlayStyle]} pointerEvents="none">
              <View style={styles.hoverPlayButton}>
                <Play size={size === 'small' ? 22 : 28} color={Colors.text.primary} fill={Colors.text.primary} />
              </View>
            </Animated.View>
          )}

          {/* Favorite button - top right */}
          <TouchableOpacity
            style={styles.favButton}
            onPress={handleFavoritePress}
            activeOpacity={0.8}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Animated.View style={favAnimatedStyle}>
              <Heart
                size={16}
                color={isFavorite ? Colors.primary : Colors.text.primary}
                fill={isFavorite ? Colors.primary : 'transparent'}
              />
            </Animated.View>
          </TouchableOpacity>

          {/* Duration badge */}
          <Animated.View entering={FadeIn.delay(150).duration(200)} style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </Animated.View>

          {/* Featured / Trending badges */}
          {video.featured && (
            <Animated.View entering={FadeIn.delay(100).duration(200)} style={styles.featuredBadge}>
              <Text style={styles.featuredText}>Featured</Text>
            </Animated.View>
          )}
          {video.trending && !video.featured && (
            <Animated.View entering={FadeIn.delay(100).duration(200)} style={styles.trendingBadge}>
              <Text style={styles.trendingText}>Trending</Text>
            </Animated.View>
          )}

          {/* Progress bar for Continue Watching */}
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
              {video.genre && (
                <View style={styles.metaItem}>
                  <Film size={11} color={Colors.text.muted} />
                  <Text style={styles.meta} numberOfLines={1}>{video.genre}</Text>
                </View>
              )}
              {uploadDate && (
                <>
                  {video.genre && <Text style={styles.metaDot}>·</Text>}
                  <View style={styles.metaItem}>
                    <Calendar size={11} color={Colors.text.muted} />
                    <Text style={styles.meta}>{uploadDate}</Text>
                  </View>
                </>
              )}
            </View>
            <View style={styles.metaRow}>
              {video.views_count > 0 && (
                <View style={styles.metaItem}>
                  <Eye size={11} color={Colors.text.muted} />
                  <Text style={styles.meta}>{formatViews(video.views_count)} views</Text>
                </View>
              )}
              {video.duration > 0 && (
                <>
                  {video.views_count > 0 && <Text style={styles.metaDot}>·</Text>}
                  <View style={styles.metaItem}>
                    <Clock size={11} color={Colors.text.muted} />
                    <Text style={styles.meta}>{duration}</Text>
                  </View>
                </>
              )}
            </View>
          </View>
        )}
      </AnimatedPressable>
    </Animated.View>
  );
}

export const VideoCard = memo(VideoCardComponent);

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
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
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hoverPlayButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  playButtonContainer: {
    opacity: 0.85,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  favButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  durationBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  durationText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
  },
  featuredBadge: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: 'rgba(229, 9, 20, 0.95)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  featuredText: {
    color: Colors.text.primary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
  },
  trendingBadge: {
    position: 'absolute',
    top: Spacing.xs,
    left: Spacing.xs,
    backgroundColor: 'rgba(59, 130, 246, 0.95)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
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
    height: 3,
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
    marginBottom: 4,
    lineHeight: 18,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  meta: {
    color: Colors.text.secondary,
    fontSize: FontSizes.xs,
  },
  metaDot: {
    color: Colors.text.muted,
    fontSize: FontSizes.xs,
    marginHorizontal: 4,
  },
});
