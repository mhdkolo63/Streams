import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Platform, Dimensions, Modal, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  ZoomIn,
  FadeOut,
  SlideInRight,
} from 'react-native-reanimated';
import { Play, Eye, Clock, Film, Calendar, Heart, Lock, Crown, MoreVertical, Bookmark, Share2, Flag, CheckCircle2, Trash2 } from 'lucide-react-native';
import { Colors, BorderRadius, FontSizes, FontWeights, Spacing } from '@/constants/theme';
import { Video, Profile } from '@/lib/supabase';
import { CachedImage } from '@/components/CachedImage';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { toggleWatchLater, isInWatchLater } from '@/lib/creators';
import { ShareSheet } from '@/components/ShareSheet';

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
  creator?: Profile | null;
  showCreator?: boolean;
  showMenu?: boolean;
  onDelete?: () => void;
}

function VideoCardComponent({
  video,
  onPress,
  size = 'medium',
  showProgress,
  progress,
  showDetails = true,
  index = 0,
  creator,
  showCreator = false,
  showMenu = true,
  onDelete,
}: VideoCardProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [favAnimating, setFavAnimating] = useState(false);
  const [inWatchLater, setInWatchLater] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const scale = useSharedValue(1);
  const overlayOpacity = useSharedValue(0);
  const favScale = useSharedValue(1);
  const favTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cardWidth = useMemo(() => {
    switch (size) {
      case 'small':
        return Math.min(width * 0.3, 160);
      case 'large':
        return Math.min(width - Spacing.lg * 2, 400);
      default:
        return Math.min(width * 0.4, 240);
    }
  }, [size]);

  const imageHeight = useMemo(() => cardWidth / CARD_ASPECT, [cardWidth]);

  const duration = useMemo(() => formatDuration(video.duration), [video.duration]);
  const uploadDate = useMemo(() =>
    video.created_at
      ? new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : '',
    [video.created_at]
  );
  const thumbnailUri = video.thumbnail_url || `https://picsum.photos/seed/${video.id}/640/360`;
  const viewsText = useMemo(() => formatViews(video.views_count), [video.views_count]);

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

  const hoverOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const favAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: favScale.value }],
  }));

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleFavoritePress = useCallback((e: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    setIsFavorite(prev => !prev);
    setFavAnimating(true);
    favScale.value = withSpring(1.4, { damping: 8, stiffness: 200 }, () => {
      favScale.value = withSpring(1, { damping: 12, stiffness: 200 });
    });
    if (favTimerRef.current) clearTimeout(favTimerRef.current);
    favTimerRef.current = setTimeout(() => setFavAnimating(false), 600);
  }, []);

  useEffect(() => {
    return () => { if (favTimerRef.current) clearTimeout(favTimerRef.current); };
  }, []);

  useEffect(() => {
    if (user) {
      isInWatchLater(user.id, video.id).then(setInWatchLater);
    }
  }, [user, video.id]);

  const handleWatchLater = useCallback(async (e: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    setMenuOpen(false);
    if (!user) {
      toast.info('Sign in required', 'Please sign in to save videos');
      return;
    }
    const result = await toggleWatchLater(user.id, video.id);
    setInWatchLater(result.added);
    toast.success(result.added ? 'Saved to Watch Later' : 'Removed from Watch Later');
  }, [user, video.id, toast]);

  const handleShare = useCallback((e: any) => {
    if (e?.stopPropagation) e.stopPropagation();
    setMenuOpen(false);
    setShowShare(true);
  }, []);

  const menuActions = [
    { icon: Bookmark, label: inWatchLater ? 'Remove from Watch Later' : 'Save to Watch Later', onPress: handleWatchLater },
    { icon: Share2, label: 'Share', onPress: handleShare },
  ];

  if (onDelete) {
    menuActions.push({ icon: Trash2, label: 'Delete', onPress: (e: any) => { if (e?.stopPropagation) e.stopPropagation(); setMenuOpen(false); onDelete(); } });
  }

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
          <CachedImage
            uri={thumbnailUri}
            fallbackUri={`https://picsum.photos/seed/${video.id}/640/360`}
            style={styles.thumbnail}
            resizeMode="cover"
          />

          <Animated.View entering={ZoomIn.delay(100).duration(200)} style={styles.overlay}>
            <View style={styles.playButtonContainer}>
              <View style={styles.playButton}>
                <Play size={size === 'small' ? 16 : 20} color={Colors.text.primary} fill={Colors.text.primary} />
              </View>
            </View>
          </Animated.View>

          {Platform.OS === 'web' && (
            <Animated.View style={[styles.hoverOverlay, hoverOverlayStyle]} pointerEvents="none">
              <View style={styles.hoverPlayButton}>
                <Play size={size === 'small' ? 22 : 28} color={Colors.text.primary} fill={Colors.text.primary} />
              </View>
            </Animated.View>
          )}

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

          <Animated.View entering={FadeIn.delay(150).duration(200)} style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </Animated.View>

          {video.is_premium && (
            <Animated.View entering={FadeIn.delay(100).duration(200)} style={styles.premiumBadge}>
              <Crown size={10} color="#FFD700" />
              <Text style={styles.premiumText}>Premium</Text>
            </Animated.View>
          )}
          {video.is_member_only && !video.is_premium && (
            <Animated.View entering={FadeIn.delay(100).duration(200)} style={styles.memberOnlyBadge}>
              <Lock size={10} color="#06B6D4" />
            </Animated.View>
          )}
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
            {showCreator && creator && (
              <View style={styles.creatorRow}>
                <Text style={styles.creatorName} numberOfLines={1}>
                  {creator.full_name || creator.username || 'Creator'}
                </Text>
                {creator.verified && (
                  <CheckCircle2 size={12} color={Colors.primary} fill={Colors.primary} />
                )}
              </View>
            )}
            <View style={styles.metaRow}>
              {video.views_count > 0 && (
                <View style={styles.metaItem}>
                  <Eye size={11} color={Colors.text.muted} />
                  <Text style={styles.meta}>{viewsText} views</Text>
                </View>
              )}
              {uploadDate && (
                <>
                  {video.views_count > 0 && <Text style={styles.metaDot}>·</Text>}
                  <View style={styles.metaItem}>
                    <Calendar size={11} color={Colors.text.muted} />
                    <Text style={styles.meta}>{uploadDate}</Text>
                  </View>
                </>
              )}
            </View>
            {video.duration > 0 && (
              <View style={styles.metaRow}>
                <View style={styles.metaItem}>
                  <Clock size={11} color={Colors.text.muted} />
                  <Text style={styles.meta}>{duration}</Text>
                </View>
                {video.genre && (
                  <>
                    <Text style={styles.metaDot}>·</Text>
                    <View style={styles.metaItem}>
                      <Film size={11} color={Colors.text.muted} />
                      <Text style={styles.meta}>{video.genre}</Text>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        )}
      </AnimatedPressable>

      {showMenu && (
        <TouchableOpacity
          style={styles.menuButton}
          onPress={(e) => { e?.stopPropagation?.(); setMenuOpen(!menuOpen); }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MoreVertical size={18} color={Colors.text.muted} />
        </TouchableOpacity>
      )}

      {menuOpen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
          <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
            <View style={styles.menuSheet}>
              {menuActions.map((action, i) => {
                const Icon = action.icon;
                return (
                  <TouchableOpacity
                    key={i}
                    style={styles.menuItem}
                    onPress={action.onPress}
                  >
                    <Icon size={18} color={Colors.text.secondary} />
                    <Text style={styles.menuItemText}>{action.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Pressable>
        </Modal>
      )}

      <ShareSheet
        visible={showShare}
        onClose={() => setShowShare(false)}
        url={typeof window !== 'undefined' ? `${window.location.origin}/video/${video.id}` : `/video/${video.id}`}
        title={video.title}
      />
    </Animated.View>
  );
}

export const VideoCard = React.memo(VideoCardComponent);

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
  menuButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: 38,
    width: 28,
    height: 28,
    borderRadius: 14,
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
  premiumBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255, 215, 0, 0.95)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    zIndex: 2,
  },
  premiumText: {
    color: '#000',
    fontSize: 10,
    fontWeight: FontWeights.bold,
  },
  memberOnlyBadge: {
    position: 'absolute',
    top: Spacing.xs,
    right: 40,
    width: 22,
    height: 22,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(6, 182, 212, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
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
  creatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  creatorName: {
    color: Colors.text.secondary,
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.medium,
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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuSheet: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    minWidth: 200,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  menuItemText: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
  },
});
