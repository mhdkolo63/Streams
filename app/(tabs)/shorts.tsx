import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  Image,
  ViewToken,
  AppState,
  Platform,
  Share,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
  Extrapolate,
  FadeIn,
} from 'react-native-reanimated';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  UserPlus,
  UserCheck,
  Play,
  Pause,
  Volume2,
  VolumeX,
  ChevronUp,
  Music,
  Eye,
  Search,
  X,
} from 'lucide-react-native';
import { supabase, Video, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { CommentsPanel } from '@/components/CommentsPanel';
import { getShortsFeed } from '@/lib/creators/shorts';
import {
  subscribeToChannel,
  unsubscribeFromChannel,
  isSubscribed,
  getSubscriberCount,
} from '@/lib/creators/subscriptions';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';

interface ShortItem extends Video {
  uploaderProfile?: Profile;
  isLiked?: boolean;
  isSaved?: boolean;
  isSubscribed?: boolean;
  subscriberCount?: number;
  likeCount?: number;
  commentCount?: number;
}

export default function ShortsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [shorts, setShorts] = useState<ShortItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Video[]>([]);
  const [searching, setSearching] = useState(false);
  const [muted, setMuted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [feedReason, setFeedReason] = useState('');

  const flatListRef = useRef<FlatList>(null);
  const videoRefs = useRef<Map<string, any>>(new Map());
  const appStateRef = useRef(AppState.currentState);
  const watchedIdsRef = useRef<Set<string>>(new Set());

  // Fetch shorts feed
  const fetchShorts = useCallback(async (excludeIds: string[] = []) => {
    try {
      const result = await getShortsFeed(user?.id, 15, excludeIds);
      setFeedReason(result.reason);

      // Enrich with profile, like, save, subscribe data
      const enriched = await Promise.all(
        result.videos.map(async (v) => {
          const [profileRes, likeRes, favRes, subRes, subCountRes, commentCountRes] = await Promise.all([
            supabase.from('profiles').select('*').eq('id', v.uploader_id || '').maybeSingle(),
            user
              ? supabase.from('video_likes').select('id').eq('video_id', v.id).eq('user_id', user.id).maybeSingle()
              : Promise.resolve({ data: null }),
            user
              ? supabase.from('favorites').select('id').eq('video_id', v.id).eq('user_id', user.id).maybeSingle()
              : Promise.resolve({ data: null }),
            user
              ? isSubscribed(user.id, v.uploader_id || '')
              : Promise.resolve(false),
            getSubscriberCount(v.uploader_id || ''),
            supabase.from('comments').select('id', { count: 'exact', head: true }).eq('video_id', v.id),
          ]);

          return {
            ...v,
            uploaderProfile: profileRes.data as Profile,
            isLiked: !!likeRes.data,
            isSaved: !!favRes.data,
            isSubscribed: subRes as boolean,
            subscriberCount: subCountRes as number,
            likeCount: v.like_count || 0,
            commentCount: commentCountRes.count || 0,
          } as ShortItem;
        })
      );

      setShorts((prev) => [...prev, ...enriched]);
    } catch (error) {
      console.error('Error fetching shorts:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Initial load
  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  // Pause on app background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        appStateRef.current = nextState;
      } else if (nextState === 'inactive' || nextState === 'background') {
        appStateRef.current = nextState;
        // Pause all videos
        videoRefs.current.forEach((videoEl) => {
          if (videoEl && videoEl.pause) videoEl.pause();
        });
        setIsPlaying(false);
      }
    });
    return () => subscription.remove();
  }, []);

  // Viewability config for detecting active short
  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const newIndex = viewableItems[0].index;
        setActiveIndex(newIndex);

        // Track watched
        const watched = viewableItems[0].item as Video;
        if (watched && watched.id) {
          watchedIdsRef.current.add(watched.id);
          // Record view
          if (user) {
            supabase.from('video_views').insert({
              video_id: watched.id,
              user_id: user.id,
              watch_duration: 0,
            }).then();
          }
        }

        // Pause all videos except active
        videoRefs.current.forEach((videoEl, videoId) => {
          if (videoId !== watched.id) {
            if (videoEl && videoEl.pause) videoEl.pause();
          }
        });

        // Play active video
        const activeVideo = videoRefs.current.get(watched.id);
        if (activeVideo && activeVideo.play) {
          activeVideo.play().catch(() => {});
          setIsPlaying(true);
        }

        // Load more when near end
        if (newIndex >= shorts.length - 3) {
          fetchShorts(shorts.map((s) => s.id));
        }
      }
    },
    [shorts, user, fetchShorts]
  );

  // Toggle like
  const toggleLike = async (short: ShortItem, index: number) => {
    if (!user) {
      toast.info('Sign in required', 'Please sign in to like shorts');
      return;
    }

    const newLiked = !short.isLiked;
    setShorts((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              isLiked: newLiked,
              likeCount: newLiked ? (s.likeCount || 0) + 1 : Math.max(0, (s.likeCount || 0) - 1),
            }
          : s
      )
    );

    try {
      if (newLiked) {
        await supabase.from('video_likes').insert({ video_id: short.id, user_id: user.id });
      } else {
        await supabase.from('video_likes').delete().eq('video_id', short.id).eq('user_id', user.id);
      }
    } catch (error) {
      // Revert on error
      setShorts((prev) =>
        prev.map((s, i) =>
          i === index
            ? { ...s, isLiked: !newLiked, likeCount: newLiked ? Math.max(0, (s.likeCount || 0) - 1) : (s.likeCount || 0) + 1 }
            : s
        )
      );
    }
  };

  // Toggle save
  const toggleSave = async (short: ShortItem, index: number) => {
    if (!user) {
      toast.info('Sign in required', 'Please sign in to save shorts');
      return;
    }

    const newSaved = !short.isSaved;
    setShorts((prev) =>
      prev.map((s, i) => (i === index ? { ...s, isSaved: newSaved } : s))
    );

    try {
      if (newSaved) {
        await supabase.from('favorites').insert({ video_id: short.id, user_id: user.id });
        toast.success('Saved to Watch Later');
      } else {
        await supabase.from('favorites').delete().eq('video_id', short.id).eq('user_id', user.id);
        toast.info('Removed from Watch Later');
      }
    } catch (error) {
      setShorts((prev) =>
        prev.map((s, i) => (i === index ? { ...s, isSaved: !newSaved } : s))
      );
    }
  };

  // Toggle subscribe
  const toggleSubscribe = async (short: ShortItem, index: number) => {
    if (!user) {
      toast.info('Sign in required', 'Please sign in to subscribe');
      return;
    }

    const newSubscribed = !short.isSubscribed;
    const channelId = short.uploader_id || '';
    setShorts((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              isSubscribed: newSubscribed,
              subscriberCount: newSubscribed ? (s.subscriberCount || 0) + 1 : Math.max(0, (s.subscriberCount || 0) - 1),
            }
          : s
      )
    );

    try {
      if (newSubscribed) {
        await subscribeToChannel(user.id, channelId);
        toast.success('Subscribed', `You'll see new content from ${short.uploaderProfile?.full_name || 'this creator'}`);
      } else {
        await unsubscribeFromChannel(user.id, channelId);
        toast.info('Unsubscribed');
      }
    } catch (error) {
      setShorts((prev) =>
        prev.map((s, i) =>
          i === index
            ? { ...s, isSubscribed: !newSubscribed, subscriberCount: newSubscribed ? Math.max(0, (s.subscriberCount || 0) - 1) : (s.subscriberCount || 0) + 1 }
            : s
        )
      );
    }
  };

  // Share
  const handleShare = async (short: ShortItem) => {
    const shareUrl = `${window.location.origin}/player/${short.id}`;
    const shareText = `Check out "${short.title}" on StreamWorld`;

    if (isWeb && navigator.share) {
      try {
        await navigator.share({ title: short.title, text: shareText, url: shareUrl });
        return;
      } catch { /* user cancelled */ }
    }

    // Fallback: show share options via toast
    if (isWeb && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied', 'Share URL copied to clipboard');
    } else if (!isWeb) {
      try {
        await Share.share({ message: `${shareText} - ${shareUrl}`, url: shareUrl });
      } catch { /* cancelled */ }
    }
  };

  // Toggle play/pause
  const togglePlayPause = (shortId: string) => {
    const videoEl = videoRefs.current.get(shortId);
    if (!videoEl) return;
    if (isPlaying) {
      videoEl.pause?.();
      setIsPlaying(false);
    } else {
      videoEl.play?.().catch(() => {});
      setIsPlaying(true);
    }
  };

  // Toggle mute
  const toggleMute = () => {
    setMuted((prev) => {
      const newMuted = !prev;
      videoRefs.current.forEach((videoEl) => {
        if (videoEl) videoEl.muted = newMuted;
      });
      return newMuted;
    });
  };

  // Search shorts
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const { data } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'published')
        .or(`title.ilike.%${query}%,tags.cs.{${query}}`)
        .limit(20);
      if (data) {
        const shorts = (data as Video[]).filter(
          (v) => v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60)
        );
        setSearchResults(shorts);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  }, []);

  // Format
  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const formatTimeAgo = (dateString: string): string => {
    const diff = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Render a single short
  const renderShort = ({ item, index }: { item: ShortItem; index: number }) => {
    const isActive = index === activeIndex;
    const creatorName = item.uploaderProfile?.full_name || item.uploaderProfile?.email?.split('@')[0] || 'Creator';
    const creatorAvatar = item.uploaderProfile?.avatar_url;

    return (
      <View style={styles.shortContainer}>
        {/* Video Background */}
        <View style={styles.videoWrapper}>
          {isWeb && item.video_url ? (
            <video
              ref={(el) => {
                if (el) {
                  videoRefs.current.set(item.id, el);
                  el.muted = muted;
                  if (isActive && isPlaying) {
                    el.play().catch(() => {});
                  }
                }
              }}
              src={item.video_url}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                backgroundColor: '#000',
              }}
              playsInline
              loop
              muted={muted}
              onClick={() => togglePlayPause(item.id)}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              {item.thumbnail_url ? (
                <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnailBg} resizeMode="cover" />
              ) : null}
              <View style={styles.playOverlay}>
                <TouchableOpacity onPress={() => togglePlayPause(item.id)}>
                  {isPlaying ? <Pause size={48} color={Colors.text.primary} /> : <Play size={48} color={Colors.text.primary} />}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Gradient Overlay */}
          <View style={styles.bottomGradient} />
          <View style={styles.topGradient} />
        </View>

        {/* Right Side Controls */}
        <View style={styles.rightControls}>
          {/* Like */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => toggleLike(item, index)}
            activeOpacity={0.7}
          >
            <Animated.View style={styles.controlIcon}>
              <Heart
                size={30}
                color={item.isLiked ? Colors.primary : Colors.text.primary}
                fill={item.isLiked ? Colors.primary : 'transparent'}
              />
            </Animated.View>
            <Text style={styles.controlLabel}>{formatCount(item.likeCount || 0)}</Text>
          </TouchableOpacity>

          {/* Comments */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setShowComments(true)}
            activeOpacity={0.7}
          >
            <View style={styles.controlIcon}>
              <MessageCircle size={30} color={Colors.text.primary} />
            </View>
            <Text style={styles.controlLabel}>{formatCount(item.commentCount || 0)}</Text>
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => handleShare(item)}
            activeOpacity={0.7}
          >
            <View style={styles.controlIcon}>
              <Share2 size={30} color={Colors.text.primary} />
            </View>
            <Text style={styles.controlLabel}>Share</Text>
          </TouchableOpacity>

          {/* Save */}
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => toggleSave(item, index)}
            activeOpacity={0.7}
          >
            <View style={styles.controlIcon}>
              <Bookmark
                size={30}
                color={item.isSaved ? Colors.primary : Colors.text.primary}
                fill={item.isSaved ? Colors.primary : 'transparent'}
              />
            </View>
            <Text style={styles.controlLabel}>{item.isSaved ? 'Saved' : 'Save'}</Text>
          </TouchableOpacity>

          {/* Creator Profile */}
          <TouchableOpacity
            style={styles.creatorButton}
            onPress={() => router.push(`/channel`)}
            activeOpacity={0.7}
          >
            {creatorAvatar ? (
              <Image source={{ uri: creatorAvatar }} style={styles.creatorAvatar} />
            ) : (
              <View style={styles.creatorAvatarPlaceholder}>
                <Text style={styles.creatorAvatarText}>{creatorName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Subscribe */}
          {user && item.uploader_id !== user.id && (
            <TouchableOpacity
              style={[styles.subscribeButton, item.isSubscribed && styles.subscribeButtonActive]}
              onPress={() => toggleSubscribe(item, index)}
              activeOpacity={0.7}
            >
              {item.isSubscribed ? (
                <UserCheck size={16} color={Colors.text.primary} />
              ) : (
                <UserPlus size={16} color={Colors.text.primary} />
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Mute Toggle */}
        <TouchableOpacity style={styles.muteButton} onPress={toggleMute} activeOpacity={0.7}>
          {muted ? <VolumeX size={20} color={Colors.text.primary} /> : <Volume2 size={20} color={Colors.text.primary} />}
        </TouchableOpacity>

        {/* Bottom Info */}
        <View style={styles.bottomInfo}>
          {/* Creator Info */}
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorName}>@{creatorName}</Text>
            {item.uploaderProfile?.bio ? (
              <Text style={styles.creatorBio} numberOfLines={1}>{item.uploaderProfile.bio}</Text>
            ) : null}
          </View>

          {/* Title */}
          <Text style={styles.shortTitle} numberOfLines={2}>{item.title}</Text>

          {/* Description */}
          {item.description ? (
            <Text style={styles.shortDescription} numberOfLines={2}>{item.description}</Text>
          ) : null}

          {/* Music Info Placeholder */}
          <View style={styles.musicInfo}>
            <Music size={14} color={Colors.text.primary} />
            <Text style={styles.musicText} numberOfLines={1}>Original audio - {creatorName}</Text>
          </View>

          {/* Meta */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Eye size={12} color={Colors.text.muted} />
              <Text style={styles.metaText}>{formatCount(item.views_count)} views</Text>
            </View>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{formatTimeAgo(item.created_at)}</Text>
          </View>
        </View>

        {/* Swipe Up Hint */}
        {index === 0 && activeIndex === 0 && (
          <Animated.View
            entering={FadeIn.delay(500).duration(500)}
            style={styles.swipeHint}
          >
            <ChevronUp size={24} color={Colors.text.muted} />
            <Text style={styles.swipeHintText}>Swipe for more</Text>
          </Animated.View>
        )}
      </View>
    );
  };

  // Loading state
  if (loading && shorts.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingCard}>
          <View style={styles.loadingIcon}>
            <Play size={40} color={Colors.primary} fill={Colors.primary} />
          </View>
          <Text style={styles.loadingText}>Loading Shorts...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (!loading && shorts.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Play size={64} color={Colors.text.muted} />
        <Text style={styles.emptyTitle}>No Shorts yet</Text>
        <Text style={styles.emptyText}>Short videos will appear here. Creators can upload 60-second clips.</Text>
        <TouchableOpacity style={styles.emptyButton} onPress={() => router.push('/studio/upload-short')}>
          <Play size={16} color={Colors.text.primary} fill={Colors.text.primary} />
          <Text style={styles.emptyButtonText}>Upload a Short</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchOverlay}>
          <View style={styles.searchBar}>
            <Search size={20} color={Colors.text.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search shorts..."
              placeholderTextColor={Colors.text.muted}
              value={searchQuery}
              onChangeText={(text) => {
                setSearchQuery(text);
                handleSearch(text);
              }}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }}>
              <X size={20} color={Colors.text.muted} />
            </TouchableOpacity>
          </View>

          {searchResults.length > 0 && (
            <View style={styles.searchResults}>
              {searchResults.slice(0, 5).map((result) => (
                <TouchableOpacity
                  key={result.id}
                  style={styles.searchResultItem}
                  onPress={() => {
                    router.push(`/player/${result.id}`);
                    setShowSearch(false);
                  }}
                >
                  {result.thumbnail_url && (
                    <Image source={{ uri: result.thumbnail_url }} style={styles.searchThumb} />
                  )}
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultTitle} numberOfLines={1}>{result.title}</Text>
                    <Text style={styles.searchResultMeta}>{formatCount(result.views_count)} views</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shorts</Text>
        <TouchableOpacity style={styles.searchButton} onPress={() => setShowSearch(!showSearch)}>
          {showSearch ? <X size={22} color={Colors.text.primary} /> : <Search size={22} color={Colors.text.primary} />}
        </TouchableOpacity>
      </View>

      {/* Feed Reason */}
      {feedReason && !showSearch && (
        <View style={styles.feedReason}>
          <Text style={styles.feedReasonText}>{feedReason}</Text>
        </View>
      )}

      {/* Shorts Feed */}
      <FlatList
        ref={flatListRef}
        data={shorts}
        keyExtractor={(item) => item.id}
        renderItem={renderShort}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={height}
        snapToAlignment="start"
        decelerationRate="fast"
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (shorts.length > 0) {
            fetchShorts(shorts.map((s) => s.id));
          }
        }}
        contentContainerStyle={styles.feed}
      />

      {/* Comments Panel */}
      <CommentsPanel
        videoId={shorts[activeIndex]?.id || ''}
        visible={showComments}
        onClose={() => setShowComments(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: Spacing.sm,
    zIndex: 20,
  },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  searchButton: { padding: Spacing.xs },
  feedReason: {
    position: 'absolute',
    top: 95,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 15,
  },
  feedReasonText: {
    fontSize: FontSizes.xs,
    color: 'rgba(255,255,255,0.6)',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: Spacing.md,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  feed: { paddingBottom: 60 },
  shortContainer: { width, height, position: 'relative' },
  videoWrapper: { width: '100%', height: '100%', backgroundColor: '#000' },
  videoPlaceholder: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.secondary },
  thumbnailBg: { width: '100%', height: '100%', position: 'absolute' },
  playOverlay: { alignItems: 'center', justifyContent: 'center' },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '40%',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 100,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  rightControls: {
    position: 'absolute',
    right: 8,
    bottom: 100,
    alignItems: 'center',
    gap: 20,
    zIndex: 10,
  },
  controlButton: { alignItems: 'center', gap: 4 },
  controlIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlLabel: { fontSize: 12, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  creatorButton: { marginTop: 8 },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: Colors.text.primary },
  creatorAvatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.text.primary },
  creatorAvatarText: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary },
  subscribeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -12,
    borderWidth: 2,
    borderColor: '#000',
  },
  subscribeButtonActive: { backgroundColor: Colors.tertiary },
  muteButton: {
    position: 'absolute',
    top: 100,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bottomInfo: {
    position: 'absolute',
    bottom: 20,
    left: 12,
    right: 80,
    gap: 6,
    zIndex: 10,
  },
  creatorInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  creatorName: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary },
  creatorBio: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.7)', flex: 1 },
  shortTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  shortDescription: { fontSize: FontSizes.sm, color: 'rgba(255,255,255,0.8)', lineHeight: 18 },
  musicInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  musicText: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.6)', flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.6)' },
  metaDot: { fontSize: FontSizes.xs, color: 'rgba(255,255,255,0.4)' },
  swipeHint: { position: 'absolute', bottom: 100, left: 0, right: 0, alignItems: 'center', zIndex: 5 },
  swipeHintText: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 4 },
  loadingContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingCard: { alignItems: 'center', gap: Spacing.md },
  loadingIcon: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(229, 9, 20, 0.1)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  emptyContainer: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl, gap: Spacing.md },
  emptyTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  emptyText: { fontSize: FontSizes.md, color: Colors.text.muted, textAlign: 'center', lineHeight: 22 },
  emptyButton: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, marginTop: Spacing.sm },
  emptyButtonText: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  searchOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.95)',
    paddingTop: 50,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    zIndex: 30,
  },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, padding: 0 },
  searchResults: { marginTop: Spacing.md, gap: Spacing.sm },
  searchResultItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.sm },
  searchThumb: { width: 50, height: 64, borderRadius: BorderRadius.sm },
  searchResultInfo: { flex: 1 },
  searchResultTitle: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium },
  searchResultMeta: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
});
