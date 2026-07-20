import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  TouchableWithoutFeedback,
  PanResponder,
  LayoutChangeEvent,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import * as ScreenOrientation from 'expo-screen-orientation';
import { CachedImage } from '@/components/CachedImage';
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
  Share2,
  Clock,
  Eye,
  Calendar,
  Heart,
  Film,
  CheckCircle,
  RotateCcw,
} from 'lucide-react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
} from 'react-native-reanimated';
import { supabase, Video as VideoType } from '@/lib/supabase';
import { getRelatedVideos } from '@/lib/recommendations';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width: initialWidth, height: initialHeight } = Dimensions.get('window');
const APP_NAME = 'StreamWorld';
const CONTROLS_HIDE_DELAY = 4000;
const DOUBLE_TAP_DELAY = 300;
const AUTOPLAY_KEY = 'streamworld_autoplay_next';
const STATUS_THROTTLE_MS = 250;

const getStoredAutoplay = (): boolean => {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(AUTOPLAY_KEY) === 'true';
  }
  return false;
};

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
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [autoPlayNext, setAutoPlayNext] = useState(false);
  const [seeking, setSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [screenWidth, setScreenWidth] = useState(initialWidth);
  const [screenHeight, setScreenHeight] = useState(initialHeight);
  const [videoAspect, setVideoAspect] = useState<number | null>(null);

  // Refs for high-frequency values to avoid re-renders
  const hideControlsTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSecond = useRef(0);
  const lastTapTime = useRef(0);
  const seekBarWidth = useRef(0);
  const isSeeking = useRef(false);
  const lastStatusUpdate = useRef(0);
  const positionRef = useRef(0);
  const durationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const autoPlayNextRef = useRef(false);
  const relatedVideosRef = useRef<VideoType[]>([]);
  const userRef = useRef(user);
  const idRef = useRef(id);
  const videoDataRef = useRef<VideoType | null>(null);
  const fullscreenRef = useRef(false);
  const containerRef = useRef<View>(null);

  // Keep refs in sync
  useEffect(() => { positionRef.current = position; }, [position]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { isPlayingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { autoPlayNextRef.current = autoPlayNext; }, [autoPlayNext]);
  useEffect(() => { relatedVideosRef.current = relatedVideos; }, [relatedVideos]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { idRef.current = id; }, [id]);
  useEffect(() => { videoDataRef.current = videoData; }, [videoData]);
  useEffect(() => { fullscreenRef.current = isFullscreen; }, [isFullscreen]);

  // Load autoplay preference from storage
  useEffect(() => {
    setAutoPlayNext(getStoredAutoplay());
  }, []);

  // Listen for dimension changes (orientation)
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
      setScreenHeight(window.height);
    });
    return () => subscription?.remove();
  }, []);

  const saveProgress = useCallback(async (currentPosition: number) => {
    const currentUser = userRef.current;
    const currentId = idRef.current;
    const currentVideo = videoDataRef.current;
    if (!currentUser || !currentId || !currentVideo) return;
    try {
      await supabase.from('watch_history').upsert(
        {
          user_id: currentUser.id,
          video_id: currentId,
          progress: Math.floor(currentPosition),
          completed: currentVideo.duration ? currentPosition >= currentVideo.duration - 10 : false,
          last_watched_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,video_id' }
      );
    } catch (err) {
      // Silent - progress saving shouldn't interrupt playback
    }
  }, []);

  const fetchVideo = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    setPlaybackError(null);
    setHasInitialized(false);
    lastSavedSecond.current = 0;

    try {
      const { data: vData, error: fetchError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (fetchError || !vData) {
        setError('Video not found');
        setLoading(false);
        return;
      }

      setVideoData(vData);
      setVideoUri(vData.video_url);
      setViewCount(vData.views_count || 0);
      setLikeCount(vData.like_count || 0);

      if (vData.created_at) {
        const date = new Date(vData.created_at);
        setUploadDate(date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
      }

      if (user) {
        const [historyRes, likeRes, favRes] = await Promise.all([
          supabase
            .from('watch_history')
            .select('progress')
            .eq('video_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('video_likes')
            .select('id')
            .eq('video_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
          supabase
            .from('favorites')
            .select('id')
            .eq('video_id', id)
            .eq('user_id', user.id)
            .maybeSingle(),
        ]);

        if (historyRes.data && historyRes.data.progress > 5) {
          setInitialPosition(historyRes.data.progress);
        }
        setIsLiked(!!likeRes.data);
        setInFavorites(!!favRes.data);
      }

      const relatedResult = await getRelatedVideos(vData as VideoType, 10);
      setRelatedVideos(relatedResult.videos);

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
    } catch (err) {
      console.error('Error fetching video:', err);
      setError('Failed to load video');
      toast.error('Failed to load video', 'Please check your connection and try again');
      setLoading(false);
    }
  }, [id, user, toast]);

  useEffect(() => {
    fetchVideo();
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
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

  // Throttled playback status handler - prevents excessive re-renders
  const handlePlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if ((status as any).error) {
        setPlaybackError((status as any).error);
      }
      return;
    }

    const now = Date.now();
    const shouldUpdateState = now - lastStatusUpdate.current >= STATUS_THROTTLE_MS;

    const newPos = status.positionMillis / 1000;
    const newDur = status.durationMillis ? status.durationMillis / 1000 : 0;
    const newPlaying = status.isPlaying;
    const newBuffering = status.isBuffering;

    // Detect video aspect ratio from natural size (only once)
    const statusAny = status as any;
    if (statusAny.naturalSize && statusAny.naturalSize.width && statusAny.naturalSize.height) {
      const aspect = statusAny.naturalSize.width / statusAny.naturalSize.height;
      setVideoAspect(prev => prev !== aspect ? aspect : prev);
    }

    // Handle playback finish
    if (status.didJustFinish) {
      setIsPlaying(false);
      if (autoPlayNextRef.current && relatedVideosRef.current.length > 0) {
        const nextVideo = relatedVideosRef.current[0];
        toast.info('Playing next video', nextVideo.title);
        router.push(`/player/${nextVideo.id}`);
        return;
      }
    }

    // Save progress every 5 seconds
    const currentSecond = Math.floor(newPos);
    if (currentSecond > 0 && currentSecond % 5 === 0 && currentSecond !== lastSavedSecond.current) {
      lastSavedSecond.current = currentSecond;
      saveProgress(newPos);
    }

    // Throttle state updates to prevent excessive re-renders
    if (shouldUpdateState || newPlaying !== isPlayingRef.current || newBuffering) {
      lastStatusUpdate.current = now;
      setPosition(newPos);
      if (newDur > 0) setDuration(newDur);
      setIsPlaying(newPlaying);
      setBuffering(newBuffering);
    }
  }, [saveProgress, router, toast]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimeout.current) {
      clearTimeout(hideControlsTimeout.current);
    }
    hideControlsTimeout.current = setTimeout(() => {
      if (isPlayingRef.current) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, CONTROLS_HIDE_DELAY);
  }, []);

  const togglePlayPause = useCallback(async () => {
    if (videoRef.current) {
      if (isPlayingRef.current) {
        await videoRef.current.pauseAsync();
      } else {
        await videoRef.current.playAsync();
      }
    }
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const toggleMute = useCallback(async () => {
    if (videoRef.current) {
      await videoRef.current.setIsMutedAsync(!isMuted);
      setIsMuted(!isMuted);
    }
    showControlsTemporarily();
  }, [isMuted, showControlsTemporarily]);

  const handleVolumeChange = useCallback(async (newVolume: number) => {
    const clamped = Math.max(0, Math.min(1, newVolume));
    setVolume(clamped);
    if (videoRef.current) {
      await videoRef.current.setVolumeAsync(clamped);
      if (clamped > 0 && isMuted) {
        await videoRef.current.setIsMutedAsync(false);
        setIsMuted(false);
      }
    }
  }, [isMuted]);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (fullscreenRef.current) {
        // Exit fullscreen
        if (Platform.OS === 'web' && typeof document !== 'undefined' && document.fullscreenElement) {
          await document.exitFullscreen();
        }
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      } else {
        // Enter fullscreen
        if (Platform.OS === 'web' && containerRef.current) {
          // Web: use Fullscreen API on the container
          const el = containerRef.current as any;
          if (el.requestFullscreen) {
            await el.requestFullscreen();
          } else if (el.webkitRequestFullscreen) {
            await el.webkitRequestFullscreen();
          }
        }
        // Mobile: lock to landscape
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE_RIGHT);
        setIsFullscreen(true);
      }
    } catch (e) {
      // Fallback: just toggle the state
      setIsFullscreen(prev => !prev);
    }
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  // Listen for web fullscreen change events
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);
      if (!isFs) {
        ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const skip = useCallback(async (seconds: number) => {
    if (videoRef.current) {
      const newPosition = Math.max(0, Math.min(positionRef.current + seconds, durationRef.current));
      await videoRef.current.setPositionAsync(newPosition * 1000);
      setPosition(newPosition);
    }
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  const setSpeed = useCallback(async (speed: number) => {
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    if (videoRef.current) {
      await videoRef.current.setRateAsync(speed, true);
    }
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  // PanResponder for seek bar dragging
  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        isSeeking.current = true;
        setSeeking(true);
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / (seekBarWidth.current || 1)));
        setSeekPosition(pct * durationRef.current);
      },
      onPanResponderMove: (evt) => {
        if (!isSeeking.current) return;
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / (seekBarWidth.current || 1)));
        setSeekPosition(pct * durationRef.current);
      },
      onPanResponderRelease: async (evt) => {
        const x = evt.nativeEvent.locationX;
        const pct = Math.max(0, Math.min(1, x / (seekBarWidth.current || 1)));
        const targetPosition = pct * durationRef.current;
        setSeeking(false);
        isSeeking.current = false;
        if (videoRef.current) {
          await videoRef.current.setPositionAsync(targetPosition * 1000);
          setPosition(targetPosition);
        }
        showControlsTemporarily();
      },
      onPanResponderTerminate: () => {
        setSeeking(false);
        isSeeking.current = false;
      },
    })
  ).current;

  const handleSeekBarLayout = useCallback((e: LayoutChangeEvent) => {
    seekBarWidth.current = e.nativeEvent.layout.width;
  }, []);

  const handleBack = useCallback(async () => {
    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined' && document.fullscreenElement) {
        await document.exitFullscreen();
      }
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    } catch (e) {}
    if (userRef.current && videoDataRef.current) {
      await saveProgress(positionRef.current);
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, [router, saveProgress]);

  // Optimistic like toggle - instant UI update, background DB save
  const toggleLike = useCallback(async () => {
    if (!user || !videoData) {
      toast.warning('Sign in required', 'Please sign in to like videos');
      return;
    }

    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount(prev => wasLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasLiked) {
        await supabase.from('video_likes').delete().eq('video_id', videoData.id).eq('user_id', user.id);
      } else {
        await supabase.from('video_likes').insert({ video_id: videoData.id, user_id: user.id });
      }
    } catch (err) {
      setIsLiked(wasLiked);
      setLikeCount(prev => wasLiked ? prev + 1 : Math.max(0, prev - 1));
      toast.error('Action failed', 'Please try again');
    }
  }, [user, videoData, isLiked, toast]);

  // Optimistic favorite toggle - instant UI update, background DB save
  const toggleFavorite = useCallback(async () => {
    if (!user || !videoData) {
      toast.warning('Sign in required', 'Please save videos to watch later');
      return;
    }

    const wasFav = inFavorites;
    setInFavorites(!wasFav);

    try {
      if (wasFav) {
        await supabase.from('favorites').delete().eq('video_id', videoData.id).eq('user_id', user.id);
      } else {
        await supabase.from('favorites').insert({ video_id: videoData.id, user_id: user.id });
      }
    } catch (err) {
      setInFavorites(wasFav);
      toast.error('Action failed', 'Please try again');
    }
  }, [user, videoData, inFavorites, toast]);

  const handleShare = useCallback(async () => {
    if (!videoData) return;
    try {
      if (Platform.OS === 'web' && navigator.share) {
        await navigator.share({
          title: videoData.title,
          text: videoData.description || `Watch ${videoData.title} on ${APP_NAME}`,
          url: typeof window !== 'undefined' ? `${window.location.origin}/video/${videoData.id}` : '',
        });
      } else {
        await Share.share({ message: `Watch "${videoData.title}" on ${APP_NAME}!` });
      }
    } catch (err) {
      // User cancelled or error
    }
  }, [videoData]);

  const handleTap = useCallback((side: 'left' | 'right') => {
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
  }, [skip, showControlsTemporarily]);

  const toggleAutoplay = useCallback(() => {
    const newValue = !autoPlayNext;
    setAutoPlayNext(newValue);
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(AUTOPLAY_KEY, String(newValue));
    }
  }, [autoPlayNext]);

  const handleRetry = useCallback(() => {
    setPlaybackError(null);
    if (videoRef.current && videoUri) {
      videoRef.current.replayAsync();
    } else {
      fetchVideo();
    }
  }, [videoUri, fetchVideo]);

  const formatTime = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const formatViews = useCallback((views: number): string => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  }, []);

  const formatDuration = useCallback((seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
  }, []);

  // Memoized display calculations to prevent recompute on every render
  const displayMetrics = useMemo(() => {
    const containerWidth = screenWidth;
    const containerHeight = isFullscreen ? screenHeight : Math.min(containerWidth * 0.5625, screenHeight * 0.36);

    let videoDisplayWidth = containerWidth;
    let videoDisplayHeight = containerHeight;

    if (videoAspect && videoAspect > 0) {
      const containerAspect = containerWidth / containerHeight;
      if (videoAspect < containerAspect) {
        // Portrait: fit by height, black bars on sides
        videoDisplayHeight = containerHeight;
        videoDisplayWidth = containerHeight * videoAspect;
      } else {
        // Landscape: fit by width
        videoDisplayWidth = containerWidth;
        videoDisplayHeight = containerWidth / videoAspect;
      }
    }

    return { containerWidth, containerHeight, videoDisplayWidth, videoDisplayHeight };
  }, [screenWidth, screenHeight, isFullscreen, videoAspect]);

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
  const { containerWidth, containerHeight, videoDisplayWidth, videoDisplayHeight } = displayMetrics;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={isFullscreen} />
      <View style={[styles.container, isFullscreen && styles.fullscreenContainer]}>
        <View
          ref={containerRef}
          style={[styles.videoWrapper, { width: containerWidth, height: containerHeight }]}
        >
          <View style={styles.videoCenterContainer}>
            <Video
              ref={videoRef}
              source={{ uri: videoUri }}
              style={{ width: videoDisplayWidth, height: videoDisplayHeight }}
              resizeMode={ResizeMode.CONTAIN}
              onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
              shouldPlay={false}
              isLooping={false}
              useNativeControls={false}
              volume={volume}
              // Preload only metadata for faster startup
              progressUpdateIntervalMillis={250}
            />
          </View>

          {/* Poster image shown before video starts playing */}
          {!isPlaying && !buffering && videoData?.thumbnail_url && (
            <View style={styles.posterOverlay} pointerEvents="none">
              <CachedImage
                uri={videoData.thumbnail_url}
                fallbackUri={`https://picsum.photos/seed/${videoData.id}/1280/720`}
                style={styles.posterImage}
                resizeMode="cover"
                blurRadius={2}
              />
              <View style={styles.posterPlayButton}>
                <Play size={48} color={Colors.text.primary} fill={Colors.text.primary} />
              </View>
            </View>
          )}

          {buffering && !playbackError && (
            <View style={styles.bufferingOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          )}

          {playbackError && (
            <View style={styles.playbackErrorOverlay}>
              <View style={styles.playbackErrorCard}>
                <Text style={styles.playbackErrorTitle}>Playback Error</Text>
                <Text style={styles.playbackErrorDesc}>
                  {typeof playbackError === 'string' ? playbackError : 'Unable to play this video. Please try again.'}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                  <RotateCcw size={18} color={Colors.text.primary} />
                  <Text style={styles.retryText}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {showControls && !playbackError && (
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
                  <View
                    style={styles.seekBar}
                    {...seekPanResponder.panHandlers}
                    onLayout={handleSeekBarLayout}
                  >
                    <View style={styles.seekTrack} />
                    <View style={[styles.seekFill, { width: `${progressPercent}%` }]} />
                    <View style={[styles.seekThumb, { left: `${progressPercent}%` }]} />
                  </View>
                  <Text style={styles.timeText}>{formatTime(duration)}</Text>
                </View>

                <View style={styles.bottomActions}>
                  <View style={styles.bottomLeftActions}>
                    <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
                      {isMuted ? <VolumeX size={22} color={Colors.text.primary} /> : <Volume2 size={22} color={Colors.text.primary} />}
                    </TouchableOpacity>
                    <View style={styles.volumeSliderContainer}>
                      <View style={styles.volumeSliderTrack}>
                        <View style={[styles.volumeSliderFill, { width: `${(isMuted ? 0 : volume) * 100}%` }]} />
                      </View>
                      <TouchableOpacity
                        style={styles.volumeSliderTouch}
                        onPress={(e) => {
                          const x = e.nativeEvent.locationX;
                          const pct = Math.max(0, Math.min(1, x / 100));
                          handleVolumeChange(pct);
                        }}
                      />
                    </View>
                    <TouchableOpacity style={styles.speedBadge} onPress={() => setShowSpeedMenu(true)}>
                      <Text style={styles.speedBadgeText}>{playbackSpeed}x</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.bottomRightActions}>
                    <TouchableOpacity style={styles.autoPlayButton} onPress={toggleAutoplay}>
                      <View style={[styles.autoPlayDot, autoPlayNext && styles.autoPlayDotActive]} />
                      <Text style={[styles.autoPlayText, autoPlayNext && styles.autoPlayTextActive]}>
                        Autoplay {autoPlayNext ? 'ON' : 'OFF'}
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

          {!showControls && !playbackError && (
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
              {videoData?.genre && (
                <View style={styles.metaItem}>
                  <Film size={16} color={Colors.text.secondary} />
                  <Text style={styles.metaText}>{videoData.genre}</Text>
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
                        source={{ uri: video.thumbnail_url || `https://picsum.photos/seed/${video.id}/320/180` }}
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
  videoWrapper: { backgroundColor: '#000', position: 'relative' },
  videoCenterContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  seekBar: { flex: 1, height: 24, justifyContent: 'center', position: 'relative' },
  seekTrack: { height: 4, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: BorderRadius.full },
  seekFill: { position: 'absolute', height: 4, backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  seekThumb: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary, marginLeft: -7 },
  timeText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium, minWidth: 45, textAlign: 'center' },
  bottomActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bottomLeftActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  bottomRightActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  volumeSliderContainer: {
    width: 100,
    height: 24,
    justifyContent: 'center',
    position: 'relative',
  },
  volumeSliderTrack: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
  },
  volumeSliderFill: {
    height: 4,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  volumeSliderTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  speedBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BorderRadius.sm,
  },
  speedBadgeText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  autoPlayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: BorderRadius.full,
  },
  autoPlayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  autoPlayDotActive: {
    backgroundColor: Colors.primary,
  },
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
  posterOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  posterImage: {
    ...StyleSheet.absoluteFillObject,
  },
  posterPlayButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playbackErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  playbackErrorCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
    maxWidth: 320,
  },
  playbackErrorTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  playbackErrorDesc: { fontSize: FontSizes.sm, color: Colors.text.secondary, textAlign: 'center', lineHeight: 20 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  retryText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, gap: Spacing.md },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 48, gap: Spacing.md },
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
