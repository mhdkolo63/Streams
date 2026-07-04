import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Info, ChevronRight, Search, Bell, Flame, Star, Clock, TrendingUp, Sparkles, Film, Calendar } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, SlideInRight, useSharedValue, useAnimatedStyle, withTiming, withDelay, runOnJS } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VideoRow } from '@/components/VideoRow';
import { HeroSkeleton, VideoRowSkeleton } from '@/components/Skeleton';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');
const HERO_ROTATION_INTERVAL = 8000; // 8 seconds per slide

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [featuredVideos, setFeaturedVideos] = useState<Video[]>([]);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [topRatedVideos, setTopRatedVideos] = useState<Video[]>([]);
  const [popularVideos, setPopularVideos] = useState<Video[]>([]);
  const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
  const [continueWatching, setContinueWatching] = useState<Video[]>([]);
  const [continueWatchingProgress, setContinueWatchingProgress] = useState<Record<string, number>>({});
  const [categories, setCategories] = useState<{ name: string; slug: string; videos: Video[] }[]>([]);
  const [genres, setGenres] = useState<{ name: string; videos: Video[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = useCallback(async () => {
    try {
      const [
        featuredRes,
        trendingRes,
        recentRes,
        topRatedRes,
        popularRes,
        recommendedRes,
        categoriesRes,
        weeklyViewsRes,
      ] = await Promise.all([
        supabase.from('videos').select('*').eq('featured', true).eq('status', 'published').order('created_at', { ascending: false }).limit(5),
        supabase.from('videos').select('*').eq('trending', true).eq('status', 'published').order('views_count', { ascending: false }).limit(15),
        supabase.from('videos').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(15),
        supabase.from('videos').select('*').eq('status', 'published').order('like_count', { ascending: false }).limit(15),
        supabase.from('videos').select('*').eq('status', 'published').order('views_count', { ascending: false }).limit(15),
        supabase.from('videos').select('*').eq('status', 'published').order('views_count', { ascending: false }).limit(20),
        supabase.from('categories').select('name, slug').order('name'),
        // Get videos for the current week
        supabase.from('video_views').select('video_id').gte('viewed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      if (featuredRes.data) setFeaturedVideos(featuredRes.data as Video[]);
      if (trendingRes.data) setTrendingVideos(trendingRes.data);
      if (recentRes.data) setRecentVideos(recentRes.data);
      if (topRatedRes.data) setTopRatedVideos(topRatedRes.data);
      if (popularRes.data) setPopularVideos(popularRes.data);
      if (recommendedRes.data) setRecommendedVideos(recommendedRes.data);

      // Fetch category videos
      if (categoriesRes.data && categoriesRes.data.length > 0) {
        const cats = categoriesRes.data as { name: string; slug: string }[];
        const categoryResults = await Promise.all(
          cats.slice(0, 6).map(async (cat) => {
            const catIdRes = await supabase.from('categories').select('id').eq('slug', cat.slug).maybeSingle();
            if (!catIdRes.data) return { name: cat.name, slug: cat.slug, videos: [] };

            const { data: junctionData } = await supabase
              .from('video_categories')
              .select('videos(*)')
              .eq('category_id', catIdRes.data.id)
              .limit(15);

            const videos = junctionData
              ?.filter((v) => v.videos && !Array.isArray(v.videos))
              .map((v) => v.videos as unknown as Video) || [];

            return { name: cat.name, slug: cat.slug, videos };
          })
        );
        setCategories(categoryResults.filter((cv) => cv.videos.length > 0));
      }

      // Group videos by genre
      if (recentRes.data) {
        const genreMap = new Map<string, Video[]>();
        recentRes.data.forEach((video) => {
          if (video.genre) {
            const existing = genreMap.get(video.genre) || [];
            genreMap.set(video.genre, [...existing, video]);
          }
        });
        setGenres(Array.from(genreMap.entries()).map(([name, videos]) => ({ name, videos })).slice(0, 4));
      }

      // Fetch user-specific data
      if (user) {
        const [watchHistoryRes, unreadRes] = await Promise.all([
          supabase.from('watch_history').select('video_id, progress, videos(*)').eq('user_id', user.id).eq('completed', false).order('last_watched_at', { ascending: false }).limit(10),
          supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
        ]);

        if (watchHistoryRes.data) {
          const videos: Video[] = [];
          const progressMap: Record<string, number> = {};
          watchHistoryRes.data.forEach((item) => {
            if (item.videos && !Array.isArray(item.videos)) {
              const video = item.videos as Video;
              videos.push(video);
              progressMap[video.id] = video.duration > 0 ? Math.min(100, (item.progress / video.duration) * 100) : 0;
            }
          });
          setContinueWatching(videos);
          setContinueWatchingProgress(progressMap);
        }

        setUnreadCount(unreadRes.count || 0);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching home data:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-rotate hero banner
  useEffect(() => {
    if (featuredVideos.length <= 1) return;

    heroTimerRef.current = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % featuredVideos.length);
    }, HERO_ROTATION_INTERVAL);

    return () => {
      if (heroTimerRef.current) {
        clearInterval(heroTimerRef.current);
      }
    };
  }, [featuredVideos.length]);

  // Reset to first slide when featured videos change
  useEffect(() => {
    setCurrentHeroIndex(0);
  }, [featuredVideos]);

  const goToHeroSlide = useCallback((index: number) => {
    setCurrentHeroIndex(index);
    // Reset timer when user manually navigates
    if (heroTimerRef.current) {
      clearInterval(heroTimerRef.current);
      heroTimerRef.current = setInterval(() => {
        setCurrentHeroIndex((prev) => (prev + 1) % featuredVideos.length);
      }, HERO_ROTATION_INTERVAL);
    }
  }, [featuredVideos.length]);

  useEffect(() => {
    const channel = supabase
      .channel('videos-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'videos', filter: 'status=eq.published' }, () => fetchData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'videos' }, () => fetchData())
      .subscribe();

    let notifChannel: ReturnType<typeof supabase.channel> | null = null;
    if (user) {
      notifChannel = supabase
        .channel('home-notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchData())
        .subscribe();
    }

    return () => {
      supabase.removeChannel(channel);
      if (notifChannel) supabase.removeChannel(notifChannel);
    };
  }, [fetchData, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const heroSections = useMemo(() => {
    if (loading) return null;
    return [
      { videos: continueWatching, progressMap: continueWatchingProgress, title: 'Continue Watching', showProgress: true },
      { videos: trendingVideos, title: 'Trending Now', icon: TrendingUp },
      { videos: recentVideos, title: 'Recently Added', icon: Sparkles },
      { videos: popularVideos, title: 'Popular This Week', icon: Flame },
      { videos: topRatedVideos, title: 'Top Rated', icon: Star },
      { videos: recommendedVideos, title: 'Recommended For You', icon: Film },
    ].filter((section, index) => index === 0 ? section.videos.length > 0 : section.videos.length > 0);
  }, [loading, continueWatching, trendingVideos, recentVideos, popularVideos, topRatedVideos, recommendedVideos, continueWatchingProgress]);

  const renderHeroBanner = () => {
    if (loading) return <HeroSkeleton />;
    if (featuredVideos.length === 0) {
      // Default hero when no featured videos
      return (
        <Animated.View entering={FadeIn.duration(500)} style={styles.heroContainer}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=675&fit=crop' }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroGradient} />
          <View style={styles.heroTopGradient} />
          <View style={styles.heroContent}>
            <Animated.Text entering={FadeInUp.delay(200).duration(400)} style={styles.heroTitle}>
              Welcome to StreamFlix
            </Animated.Text>
            <Animated.Text entering={FadeInUp.delay(300).duration(400)} style={styles.heroDescription} numberOfLines={3}>
              Discover the best movies and shows. Sign in to start watching premium content curated just for you.
            </Animated.Text>
          </View>
        </Animated.View>
      );
    }

    const video = featuredVideos[currentHeroIndex];
    const heroImage = video?.thumbnail_url || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=675&fit=crop';

    return (
      <Animated.View entering={FadeIn.duration(500)} style={styles.heroContainer}>
        <Image source={{ uri: heroImage }} style={styles.heroImage} resizeMode="cover" />
        <View style={styles.heroOverlay} />
        <View style={styles.heroGradient} />
        <View style={styles.heroTopGradient} />

        <View style={styles.heroContent}>
          <Animated.View entering={FadeInUp.delay(200).duration(400)} style={styles.heroBadge}>
            <Flame size={14} color={Colors.primary} />
            <Text style={styles.heroBadgeText}>FEATURED</Text>
          </Animated.View>

          <Animated.Text key={`title-${currentHeroIndex}`} entering={FadeInUp.duration(400)} style={styles.heroTitle}>
            {video?.title || 'Welcome to StreamFlix'}
          </Animated.Text>

          <Animated.View key={`meta-${currentHeroIndex}`} entering={FadeInUp.delay(100).duration(400)} style={styles.heroMetaRow}>
            {video?.release_year && (
              <View style={styles.heroMetaItem}>
                <Calendar size={14} color={Colors.text.secondary} />
                <Text style={styles.heroMetaText}>{video.release_year}</Text>
              </View>
            )}
            {video?.genre && (
              <>
                <Text style={styles.heroDot}>·</Text>
                <Text style={styles.heroMetaText}>{video.genre}</Text>
              </>
            )}
            {video && (
              <>
                <Text style={styles.heroDot}>·</Text>
                <Text style={styles.heroMetaText}>{formatViews(video.views_count)} views</Text>
              </>
            )}
          </Animated.View>

          <Animated.Text key={`desc-${currentHeroIndex}`} entering={FadeInUp.delay(200).duration(400)} style={styles.heroDescription} numberOfLines={3}>
            {video?.description || 'Discover the best movies and shows. Sign in to start watching premium content curated just for you.'}
          </Animated.Text>

          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => video && router.push(`/player/${video.id}`)}
              activeOpacity={0.9}
            >
              <Play size={22} color={Colors.text.primary} fill={Colors.text.primary} />
              <Text style={styles.playButtonText}>Play Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoButton}
              onPress={() => video && router.push(`/video/${video.id}`)}
              activeOpacity={0.9}
            >
              <Info size={22} color={Colors.text.primary} />
              <Text style={styles.infoButtonText}>More Info</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Hero Dots Indicator */}
        {featuredVideos.length > 1 && (
          <View style={styles.heroDots}>
            {featuredVideos.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => goToHeroSlide(index)}
                style={[styles.heroDotIndicator, index === currentHeroIndex && styles.heroDotIndicatorActive]}
              />
            ))}
          </View>
        )}
      </Animated.View>
    );
  };

  return (
    <View style={styles.mainContainer}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />}
      >
        {/* Top Bar */}
        <Animated.View entering={FadeIn.delay(100).duration(300)} style={styles.topBar}>
          <Text style={styles.appTitle}>StreamFlix</Text>
          <View style={styles.topBarActions}>
            <TouchableOpacity style={styles.topBarIcon} onPress={() => router.push('/search')} activeOpacity={0.7}>
              <Search size={22} color={Colors.text.primary} />
            </TouchableOpacity>
            {user && (
              <TouchableOpacity style={styles.topBarIcon} onPress={() => router.push('/notifications')} activeOpacity={0.7}>
                <Bell size={22} color={Colors.text.primary} />
                {unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Hero Banner */}
        {renderHeroBanner()}

        {/* Content Sections */}
        <View style={styles.contentContainer}>
          {/* Continue Watching Section */}
          {user && continueWatching.length > 0 && !loading && (
            <Animated.View entering={SlideInRight.delay(100).duration(400)}>
              <VideoRow
                title="Continue Watching"
                videos={continueWatching}
                showProgress
                progressMap={continueWatchingProgress}
                onSeeAll={() => router.push('/history')}
              />
            </Animated.View>
          )}

          {/* Trending Now */}
          <VideoRow title="Trending Now" videos={trendingVideos} loading={loading} onSeeAll={() => router.push('/search')} icon={TrendingUp} />

          {/* Recently Added */}
          <VideoRow title="Recently Added" videos={recentVideos} loading={loading} onSeeAll={() => router.push('/search')} icon={Sparkles} />

          {/* Popular This Week */}
          <VideoRow title="Popular This Week" videos={popularVideos} loading={loading} onSeeAll={() => router.push('/search')} icon={Flame} />

          {/* Top Rated */}
          <VideoRow title="Top Rated" videos={topRatedVideos} loading={loading} onSeeAll={() => router.push('/search')} icon={Star} />

          {/* Recommended For You */}
          {user && recommendedVideos.length > 0 && !loading && (
            <VideoRow title="Recommended For You" videos={recommendedVideos} loading={loading} onSeeAll={() => router.push('/search')} icon={Film} />
          )}

          {/* Categories */}
          {categories.map((category, index) => (
            <VideoRow
              key={category.slug}
              title={category.name}
              videos={category.videos}
              loading={loading}
              onSeeAll={() => router.push('/search')}
            />
          ))}

          {/* Genres */}
          {genres.map((genre) => (
            <VideoRow
              key={genre.name}
              title={genre.name}
              videos={genre.videos.slice(0, 10)}
              onSeeAll={() => router.push('/search')}
            />
          ))}
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  appTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  topBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  topBarIcon: {
    padding: Spacing.sm,
    position: 'relative',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: BorderRadius.full,
  },
  unreadBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  unreadBadgeText: {
    fontSize: 10,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  heroContainer: {
    width: '100%',
    height: height * 0.58,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 11, 11, 0.35)',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '60%',
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'linear-gradient(to top, rgba(11,11,11,1) 0%, rgba(11,11,11,0.7) 40%, rgba(11,11,11,0.3) 70%, transparent 100%)',
    } : {}),
  },
  heroTopGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'transparent',
    ...(Platform.OS === 'web' ? {
      backgroundImage: 'linear-gradient(to bottom, rgba(11,11,11,0.9) 0%, transparent 100%)',
    } : {}),
  },
  heroContent: {
    position: 'absolute',
    bottom: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  heroBadgeText: {
    fontSize: FontSizes.xs,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    letterSpacing: 1.5,
  },
  heroTitle: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  heroMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  heroMetaText: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
  },
  heroDot: {
    fontSize: FontSizes.md,
    color: Colors.text.muted,
  },
  heroDescription: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
    maxWidth: width * 0.85,
  },
  heroButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  playButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  infoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  infoButtonText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  heroDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    position: 'absolute',
    bottom: Spacing.xxl + 140,
    left: 0,
    right: 0,
  },
  heroDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  heroDotIndicatorActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  contentContainer: {
    marginTop: Spacing.lg,
  },
  footer: {
    height: Spacing.xxl,
  },
});
