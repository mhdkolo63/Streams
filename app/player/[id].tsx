import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  Share,
  Alert,
  TouchableWithoutFeedback,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  ArrowLeft,
  Settings,
  ThumbsUp,
  ThumbsDown,
  Share2,
  Clock,
  Eye,
  Calendar,
  Heart,
  ChevronRight,
  MoreVertical,
  Gauge,
  Film,
  CheckCircle,
  XCircle,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  SlideInDown,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { supabase, Video as VideoType } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');
const APP_NAME = 'StreamFlix';
const CONTROLS_HIDE_DELAY = 4000;
const DOUBLE_TAP_DELAY = 300;

export default function VideoPlayerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const videoRef = useRef<Video>(null);
  const [videoData, setVideoData] = useState<VideoType | null>(null);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [buffering, setBuffering] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [initialPosition, setInitialPosition] = useState(0);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [relatedVideos, setRelatedVideos] = useState<VideoType[]>([]);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [inFavorites, setInFavorites] = useState(false);
  const [uploadDate, setUploadDate] = useState('');
  const [viewCount, setViewCount] = useState(0);
  const [autoPlayNext, setAutoPlayNext] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSecond = useRef(0);
  const lastTapTime = useRef(0);
  const controlsOpacity = useSharedValue(1);

  const fetchVideo = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);

    try {
      const { data: videoData, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !videoData) {
        setError('Video not found');
        setLoading(false);
        return;
      }

      setVideoData(videoData);
      setVideoUri(videoData.video_url);
      setViewCount(videoData.views_count || 0);
      setLikeCount(videoData.like_count || 0);

      if (videoData.created_at) {
        const date = new Date(videoData.created_at);
        setUploadDate(date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
      }

      if (user) {
        const { data: historyData } = await supabase
          .from('watch_history')
          .select('progress')
          .eq('video_id', id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (historyData && historyData.progress > 5) {
          setInitialPosition(historyData.progress);
        }

        const { data: likeData } = await supabase
          .from('video_likes')
          .select('id')
          .eq('video_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setIsLiked(!!likeData);

        const { data: favData } = await supabase
          .from('favorites')
          .select('id')
          .eq('video_id', id)
          .eq('user_id', user.id)
          .maybeSingle();
        setInFavorites(!!favData);
      }

      let relatedQuery = supabase
        .from('videos')
        .select('*')
        .eq('status', 'published')
        .neq('id', id)
        .limit(10);

      if (videoData.genre) {
        relatedQuery = relatedQuery.eq('genre', videoData.genre);
      } else {
        relatedQuery = relatedQuery.order('created_at', { ascending: false });
      }

      const { data: related } = await relatedQuery;
      if (related && related.length > 0) {
        setRelatedVideos(related);
      } else {
        const { data: fallback } = await supabase
          .from('videos')
          .select('*')
          .eq('status', 'published')
          .neq('id', id)
          .order('views_count', { ascending: false })
          .limit(10);
        if (fallback) setRelatedVideos(fallback);
      }

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existingView } = await supabase
        .from('video_views')
        .select('id')
        .eq('video_id', id)
        .gte('viewed_at', oneHourAgo)
        .limit(1)
        .maybeSingle();

      if (!existingView) {
        await supabase.from('video_views').insert({
          video_id: id,
          user_id: user?.id || null,
          watch_duration: 0,
        });
        await supabase.rpc('increment_video_views', { video_id: id });
        setViewCount(prev => prev + 1);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching video:', error);
      setError('Failed to load video');
      toast.error('Failed to load video', 'Please check your connection and try again');
      setLoading(false);
    }
  }, [id, user, toast]);

  useEffect(() => {
    fetchVideo();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [id, fetchVideo]);

  useEffect(() => {
    if (videoRef.current && initialPosition > 0 && videoUri && !hasInitialized) {
      videoRef.current.setPositionAsync(initialPosition * 1000);
      setPosition(initialPosition);
      setHasInitialized(true);
      toast.info('Resuming playback', `Continuing from ${formatTime(initialPosition)}`);
    }
  }, [videoUri, initialPosition, hasInitialized, toast]);

  const saveProgress = useCallback(async (currentPosition: number) => {
    if (!user || !id || !videoData) return;

    try {
      await supabase.from('watch_history').upsert(
        {
          user_id: user.id,
          video_id: id,
          progress: Math.floor(currentPosition),
          completed: videoData.duration ? currentPosition >= videoData.duration - 10 : false,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      );
    } catch (error) {
      // Silent - progress saving shouldn't interrupt playback
    }
  }, [user, id, videoData]);

  const handlePlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
      setIsPlaying(status.isPlaying);
      setBuffering(status.isBuffering);

      if (status.didJustFinish && autoPlayNext && relatedVideos.length > 0) {
        const nextVideo = relatedVideos[0];
        toast.info('Playing next video', nextVideo.title);
        router.replace(`/player/${nextVideo.id}`);
        return;
      }

      const currentSecond = Math.floor(status.positionMillis / 1000);
      if (currentSecond > 0 && currentSecond % 5 === 0 && currentSecond !== lastSavedSecond.current) {
        lastSavedSecond.current = currentSecond;
        saveProgress(status.positionMillis / 1000);
      }
    }
  };

  const togglePlayPause = async () => {
    if (videoRef.current) {
      if (isPlaying) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
    showControlsTemporarily();
  };

  const toggleMute = async () => {
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
      toast.info(isMuted ? 'Sound on' : 'Sound off');
    }
    showControlsTemporarily();
  };

  const toggleFullscreen = async () => {
    try {
      if (isLandscape) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsLandscape(false);
        setIsFullscreen(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setIsLandscape(true);
        setIsFullscreen(true);
      }
    } catch (e) {
      // web may not support
    }
    showControlsTemporarily();
  };

  const skip = async (seconds: number) => {
    if (videoRef.current) {
      const newPosition = Math.max(0, Math.min(position + seconds, duration));
      await videoRef.current.setPositionAsync(newPosition * 1000);
      setPosition(newPosition);
      toast.info(seconds > 0 ? `Forward ${seconds}s` : `Back ${Math.abs(seconds)}s`);
    }
    showControlsTemporarily();
  };

  const setSpeed = async (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      await videoRef.current.setRateAsync(speed, true);
    }
    toast.info(`Speed: ${speed}x`);
    showControlsTemporarily();
  };

  const showControlsTemporarily = () => {
    setShowControls(true);
    controlsOpacity.value = withTiming(1, { duration: 200 });
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        controlsOpacity.value = withTiming(0, { duration: 200 });
        setShowSpeedMenu(false);
      }
    }, CONTROLS_HIDE_DELAY);
  };

  const handleSeek = (targetPosition: number) => {
    setSeekPosition(targetPosition);
    setSeeking(true);
  };

  const handleSeekComplete = async (targetPosition: number) => {
    setSeeking(false);
    if (videoRef.current) {
      await videoRef.current.setPositionAsync(targetPosition * 1000);
      setPosition(targetPosition);
    }
    showControlsTemporarily();
  };

  const handleBack = async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {}
    if (user && videoData) {
      await saveProgress(position);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  const toggleLike = async () => {
    if (!user || !videoData) {
      toast.warning('Sign in required', 'Please sign in to like videos');
      return;
    }

    try {
      if (isLiked) {
        await supabase.from('video_likes').delete().eq('video_id', videoData.id).eq('user_id', user.id);
        setIsLiked(false);
        setLikeCount(prev => Math.max(0, prev - 1));
        toast.info('Removed like');
      } else {
        await supabase.from('video_likes').insert({ video_id: videoData.id, user_id: user.id });
        setIsLiked(true);
        setLikeCount(prev => prev + 1);
        toast.success('Liked!', 'Added to your liked videos');
      }
    } catch (error) {
      toast.error('Action failed', 'Please try again');
    }
  };

  const toggleFavorite = async () => {
    if (!user || !videoData) {
      toast.warning('Sign in required', 'Please sign in to save videos');
      return;
    }

    try {
      if (inFavorites) {
        await supabase.from('favorites').delete().eq('video_id', videoData.id).eq('user_id', user.id);
        setInFavorites(false);
        toast.info('Removed from My List');
      } else {
        await supabase.from('favorites').insert({ video_id: videoData.id, user_id: user.id });
        setInFavorites(true);
        toast.success('Added to My List', 'Save videos to watch later');
      }
    } catch (error) {
      toast.error('Action failed', 'Please try again');
    }
  };

  const handleShare = async () => {
    if (!videoData) return;
    try {
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({
          title: videoData.title,
          text: videoData.description || `Watch ${videoData.title} on ${APP_NAME}`,
          url: typeof window !== 'undefined' ? `${window.location.origin}/video/${videoData.id}` : '',
        });
        toast.success('Shared successfully');
      } else {
        await Share.share({ message: `Watch "${videoData.title}" on ${APP_NAME}!` });
      }
    } catch (error) {
      // User cancelled or error
    }
  };

  const handleTap = (side: 'left' | 'right') => {
    const now = Date.now();
    if (now - lastTapTime.current < DOUBLE_TAP_DELAY) {
      if (side === 'left') {
        skip(-10);
      } else {
        skip(10);
      }
    }
    lastTapTime.current = now;
    showControlsTemporarily();
  };

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatViews = (views: number): string => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading video...</Text>
      </View>
    );
  }

  if (error || !videoUri) {
    return (
      <View style={styles.errorContainer}>
        <Film size={48} color={Colors.text.muted} />
        <Text style={styles.errorTitle}>{error || 'Video not found'}</Text>
        <Text style={styles.errorSubtitle}>This video may have been removed or is unavailable.</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
          <ArrowLeft size={20} color={Colors.text.primary} />
          <Text style={styles.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progressPercent = duration > 0 ? ((seeking ? seekPosition : position) / duration) * 100 : 0;
  const videoHeight = isFullscreen ? height : Math.min(width * 0.5625, height * 0.36);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={isFullscreen} />
      <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
        <View style={[styles.videoWrapper, { height: videoHeight }]}>
          <Video
            ref={videoRef}
            source={{ uri: videoUri }}
            style={styles.video}
            resizeMode={ResizeMode.CONTAIN}
            onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
            shouldPlay={true}
            isLooping={false}
            useNativeControls={false}
          />

          {buffering && (
            <View style={styles.bufferingOverlay}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}

          {showControls && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.controlsOverlay}
            >
              <View style={styles.topBar}>
                <TouchableOpacity onPress={handleBack} style={styles.controlButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <ArrowLeft size={28} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.topBarTitle} numberOfLines={1}>
                  {videoData?.title || ''}
                </Text>
                <TouchableOpacity onPress={() => setShowSpeedMenu(!showSpeedMenu)} style={styles.controlButton}>
                  <Settings size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.centerControls}>
                <TouchableWithoutFeedback onPress={() => handleTap('left')} style={styles.tapZone}>
                  <View style={styles.tapZone} />
                </TouchableWithoutFeedback>

                <View style={styles.centerButtons}>
                  <TouchableOpacity style={styles.skipButton} onPress={() => skip(-10)}>
                    <SkipBack size={28} color={Colors.text.primary} />
                    <Text style={styles.skipText}>10</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.playPauseButton} onPress={togglePlayPause}>
                    {isPlaying ? (
                      <Pause size={36} color={Colors.text.primary} fill={Colors.text.primary} />
                    ) : (
                      <Play size={36} color={Colors.text.primary} fill={Colors.text.primary} />
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.skipButton} onPress={() => skip(10)}>
                    <SkipForward size={28} color={Colors.text.primary} />
                    <Text style={styles.skipText}>10</Text>
                  </TouchableOpacity>
                </View>

                <TouchableWithoutFeedback onPress={() => handleTap('right')} style={styles.tapZone}>
                  <View style={styles.tapZone} />
                </TouchableWithoutFeedback>
              </View>

              <View style={styles.bottomBar}>
                <View style={styles.progressRow}>
                  <Text style={styles.timeText}>{formatTime(seeking ? seekPosition : position)}</Text>
                  <TouchableOpacity
                    style={styles.seekBar}
                    activeOpacity={1}
                    onPress={(e) => {
                      const x = e.nativeEvent.locationX;
                      const pct = x / (width - 80);
                      handleSeekComplete(pct * duration);
                    }}
                  >
                    <View style={styles.seekTrack} />
                    <View style={[styles.seekFill, { width: `${progressPercent}%` }]} />
                    <View style={[styles.seekThumb, { left: `${progressPercent}%` }]} />
                  </TouchableOpacity>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>

                <View style={styles.bottomActions}>
                  <View style={styles.bottomLeftActions}>
                    <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
                      {isMuted ? <VolumeX size={22} color={Colors.text.primary} /> : <Volume2 size={22} color={Colors.text.primary} />}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.speedBadge} onPress={() => setShowSpeedMenu(true)}>
                      <Text style={styles.speedBadgeText}>{playbackSpeed}x</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.bottomRightActions}>
                    <TouchableOpacity style={styles.controlButton} onPress={() => setAutoPlayNext(!autoPlayNext)}>
                      <Text style={[styles.autoPlayText, autoPlayNext && styles.autoPlayTextActive]}>
                        Auto {autoPlayNext ? 'ON' : 'OFF'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.controlButton} onPress={toggleFullscreen}>
                      {isFullscreen ? <Minimize size={22} color={Colors.text.primary} /> : <Maximize size={22} color={Colors.text.primary} />}
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Animated.View>
          )}

          {!showControls && (
            <TouchableOpacity
              style={styles.tapToShowControls}
              activeOpacity={1}
              onPress={showControlsTemporarily}
            />
          )}

          {showSpeedMenu && (
            <Animated.View entering={SlideInUp.duration(200)} style={styles.speedMenu}>
              <View style={styles.speedMenuHeader}>
                <Text style={styles.speedMenuTitle}>Playback Speed</Text>
                <TouchableOpacity onPress={() => setShowSpeedMenu(false)}>
                  <Text style={styles.speedMenuClose}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.speedOptions}>
                {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((speed) => (
                  <TouchableOpacity
                    key={speed}
                    style={[styles.speedOption, playbackSpeed === speed && styles.speedOptionActive]}
                    onPress={() => setSpeed(speed)}
                  >
                    <Text style={[styles.speedOptionText, playbackSpeed === speed && styles.speedOptionTextActive]}>
                      {speed === 1 ? 'Normal' : `${speed}x`}
                    </Text>
                    {playbackSpeed === speed && <CheckCircle size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}
        </View>

        {!isFullscreen && (
          <ScrollView style={styles.infoSection} showsVerticalScrollIndicator={false}>
            <Text style={styles.videoTitle}>{videoData?.title}</Text>

            <View style={styles.metaRow}>
              <View style={styles.metaItem}>
                <Eye size={16} color={Colors.text.secondary} />
                <Text style={styles.metaText}>{formatViews(viewCount)} views</Text>
              </View>
              <View style={styles.metaItem}>
                <Calendar size={16} color={Colors.text.secondary} />
                <Text style={styles.metaText}>{uploadDate}</Text>
              </View>
              {(videoData?.duration ?? 0) > 0 && (
                <View style={styles.metaItem}>
                  <Clock size={16} color={Colors.text.secondary} />
                  <Text style={styles.metaText}>{formatDuration(videoData?.duration ?? 0)}</Text>
                </View>
              )}
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionButton, isLiked && styles.actionButtonActive]} onPress={toggleLike}>
                <ThumbsUp size={20} color={isLiked ? Colors.primary : Colors.text.primary} fill={isLiked ? Colors.primary : 'transparent'} />
                <Text style={[styles.actionText, isLiked && styles.actionTextActive]}>{formatViews(likeCount)}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                <Share2 size={20} color={Colors.text.primary} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.actionButton, inFavorites && styles.actionButtonActive]} onPress={toggleFavorite}>
                <Heart size={20} color={inFavorites ? Colors.primary : Colors.text.primary} fill={inFavorites ? Colors.primary : 'transparent'} />
                <Text style={[styles.actionText, inFavorites && styles.actionTextActive]}>
                  {inFavorites ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>

            {videoData?.description && (
              <View style={styles.descriptionCard}>
                <Text style={styles.descriptionText} numberOfLines={4}>{videoData.description}</Text>
              </View>
            )}

            {videoData?.genre && (
              <View style={styles.genreContainer}>
                <Text style={styles.genreLabel}>Genre</Text>
                <View style={styles.genreBadge}>
                  <Text style={styles.genreText}>{videoData.genre}</Text>
                </View>
              </View>
            )}

            {relatedVideos.length > 0 && (
              <View style={styles.relatedSection}>
                <Text style={styles.relatedTitle}>Related Videos</Text>
                {relatedVideos.slice(0, 10).map((video) => (
                  <TouchableOpacity
                    key={video.id}
                    style={styles.relatedItem}
                    onPress={() => router.push(`/player/${video.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.relatedThumbnailContainer}>
                      <Image
                        source={{ uri: video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=320&h=180&fit=crop' }}
                        style={styles.relatedThumbnail}
                        resizeMode="cover"
                      />
                      <View style={styles.relatedDurationBadge}>
                        <Text style={styles.relatedDurationText}>{formatDuration(video.duration)}</Text>
                      </View>
                    </View>
                    <View style={styles.relatedInfo}>
                      <Text style={styles.relatedVideoTitle} numberOfLines={2}>{video.title}</Text>
                      <Text style={styles.relatedMeta}>{APP_NAME}</Text>
                      <View style={styles.relatedMetaRow}>
                        <Text style={styles.relatedMetaText}>{formatViews(video.views_count)} views</Text>
                        <Text style={styles.relatedMetaDot}>·</Text>
                        <Text style={styles.relatedMetaText}>
                          {video.created_at ? new Date(video.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.footer} />
          </ScrollView>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  fullscreenContainer: { paddingTop: 0 },
  videoWrapper: { width: '100%', backgroundColor: '#000', position: 'relative' },
  video: { width: '100%', height: '100%' },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'space-between',
  },
  tapToShowControls: { ...StyleSheet.absoluteFillObject },
  tapZone: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  topBarTitle: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  centerControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  centerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  skipButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  skipText: {
    fontSize: FontSizes.xs,
    color: Colors.text.primary,
    marginTop: 2,
  },
  playPauseButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  controlButton: { padding: Spacing.sm },
  bottomBar: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  seekBar: { flex: 1, height: 24, justifyContent: 'center' },
  seekTrack: { height: 4, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: BorderRadius.full },
  seekFill: { position: 'absolute', height: 4, backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  seekThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary, marginLeft: -7 },
  timeText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium, minWidth: 45, textAlign: 'center' },
  bottomActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomLeftActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bottomRightActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  speedBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BorderRadius.sm,
  },
  speedBadgeText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  autoPlayText: { fontSize: FontSizes.xs, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  autoPlayTextActive: { color: Colors.primary },
  speedMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20, 20, 20, 0.98)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  speedMenuHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  speedMenuTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  speedMenuClose: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: FontWeights.semibold },
  speedOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  speedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: Spacing.xs,
  },
  speedOptionActive: { backgroundColor: 'rgba(229, 9, 20, 0.2)' },
  speedOptionText: { fontSize: FontSizes.md, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  speedOptionTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: Spacing.md },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: Spacing.xxl, gap: Spacing.md },
  errorTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, textAlign: 'center' },
  errorSubtitle: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center' },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  backText: { fontSize: FontSizes.md, fontWeight: FontWeights.medium, color: Colors.text.primary },
  infoSection: { flex: 1, backgroundColor: Colors.background },
  videoTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, padding: Spacing.lg, paddingBottom: Spacing.sm, lineHeight: 26 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  metaText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  actionRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
  },
  actionButtonActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  actionText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium },
  actionTextActive: { color: Colors.primary },
  descriptionCard: { margin: Spacing.lg, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md },
  descriptionText: { fontSize: FontSizes.md, color: Colors.text.secondary, lineHeight: 22 },
  genreContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, gap: Spacing.sm },
  genreLabel: { fontSize: FontSizes.sm, color: Colors.text.muted },
  genreBadge: { backgroundColor: Colors.tertiary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  genreText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium },
  relatedSection: { padding: Spacing.lg },
  relatedTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.md },
  relatedItem: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  relatedThumbnailContainer: { position: 'relative' },
  relatedThumbnail: { width: 168, height: 94, borderRadius: BorderRadius.md, backgroundColor: Colors.secondary },
  relatedDurationBadge: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  relatedDurationText: { fontSize: 10, color: Colors.text.primary, fontWeight: FontWeights.medium },
  relatedInfo: { flex: 1, justifyContent: 'center' },
  relatedVideoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs, lineHeight: 18 },
  relatedMeta: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  relatedMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  relatedMetaText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  relatedMetaDot: { fontSize: FontSizes.sm, color: Colors.text.muted },
  footer: { height: Spacing.xl },
});
