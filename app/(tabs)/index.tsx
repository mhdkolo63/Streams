import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import {
  Play, Search, Bell, Flame, Star, Clock,
  TrendingUp, Sparkles, Film, Calendar, Plus, Check,
  Eye, Heart, ThumbsUp,
} from 'lucide-react-native';
import Animated, {
  FadeIn, FadeInDown, FadeInUp, ZoomIn,
} from 'react-native-reanimated';
import { supabase, Video, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VideoRow } from '@/components/VideoRow';
import { HeroSkeleton, VideoRowSkeleton } from '@/components/Skeleton';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';
import {
  getRecommendedVideos,
  getTrendingVideos,
  getMostWatchedVideos,
  getContinueWatching,
} from '@/lib/recommendations';

const { width, height } = Dimensions.get('window');
const HERO_ROTATION_INTERVAL = 9000;

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [featuredVideos, setFeaturedVideos] = useState<Video[]>([]);
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [recentVideos, setRecentVideos] = useState<Video[]>([]);
  const [mostWatchedVideos, setMostWatchedVideos] = useState<Video[]>([]);
  const [recommendedVideos, setRecommendedVideos] = useState<Video[]>([]);
  const [recommendedReason, setRecommendedReason] = useState('Recommended For You');
  const [continueWatching, setContinueWatching] = useState<Video[]>([]);
  const [continueWatchingProgress, setContinueWatchingProgress] = useState<Record<string, number>>({});
  const [categorySections, setCategorySections] = useState<{ name: string; slug: string; videos: Video[] }[]>([]);
  const [genreSections, setGenreSections] = useState<{ name: string; videos: Video[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [belowFoldReady, setBelowFoldReady] = useState(false);

  const usedVideoIds = useRef<Set<string>>(new Set());

  const markUsed = useCallback((videos: Video[]) => {
    videos.forEach(v => usedVideoIds.current.add(v.id));
    return videos;
  }, []);

  const filterUnused = useCallback((videos: Video[]) => {
    return videos.filter(v => !usedVideoIds.current.has(v.id));
  }, []);

  const fetchData = useCallback(async () => {
    try {
      usedVideoIds.current = new Set();

      const [featuredRes, recentRes, categoriesRes] = await Promise.all([
        supabase.from('videos').select('*').eq('featured', true).eq('status', 'published').order('created_at', { ascending: false }).limit(5),
        supabase.from('videos').select('*').eq('status', 'published').order('created_at', { ascending: false }).limit(20),
        supabase.from('categories').select('name, slug').order('name'),
      ]);

      const featured = (featuredRes.data as Video[]) || [];
      const recent = (recentRes.data as Video[]) || [];
      setFeaturedVideos(featured);
      setRecentVideos(filterUnused(recent));
      markUsed(recent);

      // Trending - smart calculation
      const trendingResult = await getTrendingVideos(15, Array.from(usedVideoIds.current));
      const trendingFiltered = filterUnused(trendingResult.videos);
      setTrendingVideos(trendingFiltered);
      markUsed(trendingFiltered);

      // Most Watched
      const mostWatched = await getMostWatchedVideos(15, Array.from(usedVideoIds.current));
      const mostWatchedFiltered = filterUnused(mostWatched);
      setMostWatchedVideos(mostWatchedFiltered);
      markUsed(mostWatchedFiltered);

      // Recommended For You
      const recResult = await getRecommendedVideos(user?.id || null, 15, Array.from(usedVideoIds.current));
      const recFiltered = filterUnused(recResult.videos);
      setRecommendedVideos(recFiltered);
      setRecommendedReason(recResult.hasHistory ? 'Recommended For You' : 'Trending Now');
      markUsed(recFiltered);

      // Continue Watching (user-specific)
      if (user) {
        const cwResult = await getContinueWatching(user.id, 10);
        const cwFiltered = filterUnused(cwResult.videos);
        setContinueWatching(cwFiltered);
        setContinueWatchingProgress(cwResult.progressMap);
        // Don't mark continue watching as used - they can appear in other sections too

        const [unreadRes, favRes] = await Promise.all([
          supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
          supabase.from('favorites').select('video_id').eq('user_id', user.id),
        ]);
        setUnreadCount(unreadRes.count || 0);
        if (favRes.data) setFavoriteIds(new Set(favRes.data.map(f => f.video_id)));
      }

      // Category sections - batch query to avoid N+1
      if (categoriesRes.data && categoriesRes.data.length > 0) {
        const cats = categoriesRes.data as { name: string; slug: string }[];
        // Single query: fetch all video_categories with video data for all categories at once
        const { data: allCategoryVideos } = await supabase
          .from('video_categories')
          .select('category_id, categories(slug, name), videos(*)')
          .in('category_id', (await supabase.from('categories').select('id').in('slug', cats.slice(0, 8).map(c => c.slug))).data?.map(c => c.id) || [])
          .limit(80);

        // Group by category
        const catVideoMap = new Map<string, Video[]>();
        if (allCategoryVideos) {
          for (const item of allCategoryVideos as any[]) {
            const catSlug = item.categories?.slug;
            const video = item.videos as any;
            if (catSlug && video && !Array.isArray(video) && video.status === 'published') {
              if (!catVideoMap.has(catSlug)) catVideoMap.set(catSlug, []);
              catVideoMap.get(catSlug)!.push(video as Video);
            }
          }
        }

        const categoryResults = cats.slice(0, 8).map(cat => ({
          name: cat.name,
          slug: cat.slug,
          videos: filterUnused(catVideoMap.get(cat.slug) || []).slice(0, 10),
        }));
        const validCats = categoryResults.filter(cv => cv.videos.length > 0);
        validCats.forEach(cv => markUsed(cv.videos));
        setCategorySections(validCats);
      }

      // Genre sections
      const genreMap = new Map<string, Video[]>();
      recent.forEach((video) => {
        if (video.genre) {
          const existing = genreMap.get(video.genre) || [];
          genreMap.set(video.genre, [...existing, video]);
        }
      });
      setGenreSections(
        Array.from(genreMap.entries())
          .map(([name, videos]) => ({ name, videos: filterUnused(videos).slice(0, 10) }))
          .filter(g => g.videos.length > 0)
          .slice(0, 6)
      );

      setLoading(false);
    } catch (error) {
      console.error('Error fetching home data:', error);
      setLoading(false);
    }
  }, [user, markUsed, filterUnused]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => setBelowFoldReady(true), 300);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  useEffect(() => {
    if (featuredVideos.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % featuredVideos.length);
    }, HERO_ROTATION_INTERVAL);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [featuredVideos.length]);

  useEffect(() => {
    setCurrentHeroIndex(0);
  }, [featuredVideos]);

  const goToHeroSlide = useCallback((index: number) => {
    setCurrentHeroIndex(index);
    if (heroTimerRef.current) {
      clearInterval(heroTimerRef.current);
      heroTimerRef.current = setInterval(() => {
        setCurrentHeroIndex((prev) => (prev + 1) % featuredVideos.length);
      }, HERO_ROTATION_INTERVAL);
    }
  }, [featuredVideos.length]);

  // Realtime: refetch on new published videos (debounced to avoid spam)
  useEffect(() => {
    let updateTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('videos-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'videos', filter: 'status=eq.published' }, () => {
        cache.invalidatePrefix('homepage:');
        fetchData();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'videos' }, () => {
        cache.invalidatePrefix('homepage:');
        fetchData();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'videos' }, () => {
        // Debounce UPDATE events - only refetch after 2s of no updates
        if (updateTimer) clearTimeout(updateTimer);
        updateTimer = setTimeout(() => {
          cache.invalidatePrefix('homepage:');
          fetchData();
        }, 2000);
      })
      .subscribe();

    let notifChannel: ReturnType<typeof supabase.channel> | null = null;
    if (user) {
      notifChannel = supabase
        .channel('home-notifications')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
          supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false)
            .then(({ count }) => setUnreadCount(count || 0));
        })
        .subscribe();
    }

    return () => {
      if (updateTimer) clearTimeout(updateTimer);
      supabase.removeChannel(channel);
      if (notifChannel) supabase.removeChannel(notifChannel);
    };
  }, [fetchData, user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const toggleHeroFavorite = useCallback(async (video: Video) => {
    if (!user) {
      router.push('/auth/login');
      return;
    }
    const isFav = favoriteIds.has(video.id);
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(video.id);
      else next.add(video.id);
      return next;
    });
    try {
      if (isFav) {
        await supabase.from('favorites').delete().eq('video_id', video.id).eq('user_id', user.id);
      } else {
        await supabase.from('favorites').insert({ video_id: video.id, user_id: user.id });
      }
    } catch (e) {
      setFavoriteIds(prev => {
        const next = new Set(prev);
        if (isFav) next.add(video.id);
        else next.delete(video.id);
        return next;
      });
    }
  }, [user, favoriteIds, router]);

  const renderHeroBanner = () => {
    if (loading) return <HeroSkeleton />;
    if (featuredVideos.length === 0) {
      return (
        <Animated.View entering={FadeIn.duration(500)} style={styles.heroContainer}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=1200&h=675&fit=crop' }} style={styles.heroImage} resizeMode="cover" />
          <View style={styles.heroOverlay} />
          <View style={styles.heroGradient} />
          <View style={styles.heroTopGradient} />
          <View style={styles.heroContent}>
            <Animated.Text entering={FadeInUp.delay(200).duration(400)} style={styles.heroTitle}>
              Welcome to StreamWorld
            </Animated.Text>
            <Animated.Text entering={FadeInUp.delay(300).duration(400)} style={styles.heroDescription} numberOfLines={2}>
              Discover the best movies and shows. Sign in to start watching premium content curated just for you.
            </Animated.Text>
            <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.heroButtons}>
              <TouchableOpacity style={styles.playButton} onPress={() => router.push('/search')} activeOpacity={0.9}>
                <Play size={22} color={Colors.text.primary} fill={Colors.text.primary} />
                <Text style={styles.playButtonText}>Browse Content</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      );
    }

    const video = featuredVideos[currentHeroIndex];
    const isFav = favoriteIds.has(video.id);

    return (
      <Animated.View entering={FadeIn.duration(500)} style={styles.heroContainer}>
        {featuredVideos.map((v, idx) => (
          <Animated.Image
            key={v.id}
            source={{ uri: v.thumbnail_url || `https://picsum.photos/seed/${v.id}/1200/675` }}
            style={[styles.heroImage, { opacity: idx === currentHeroIndex ? 1 : 0 }]}
            resizeMode="cover"
          />
        ))}
        <View style={styles.heroOverlay} />
        <View style={styles.heroGradient} />
        <View style={styles.heroTopGradient} />

        <View style={styles.heroContent}>
          <Animated.View key={`badge-${currentHeroIndex}`} entering={FadeInUp.delay(100).duration(400)} style={styles.heroBadge}>
            <Flame size={14} color={Colors.primary} />
            <Text style={styles.heroBadgeText}>FEATURED</Text>
          </Animated.View>

          <Animated.Text key={`title-${currentHeroIndex}`} entering={FadeInUp.delay(200).duration(400)} style={styles.heroTitle}>
            {video?.title || 'Welcome to StreamWorld'}
          </Animated.Text>

          <Animated.View key={`meta-${currentHeroIndex}`} entering={FadeInUp.delay(300).duration(400)} style={styles.heroMetaRow}>
            {video?.genre && (
              <View style={styles.heroMetaItem}>
                <Film size={14} color={Colors.text.secondary} />
                <Text style={styles.heroMetaText}>{video.genre}</Text>
              </View>
            )}
            {video?.release_year && (
              <>
                <Text style={styles.heroDot}>·</Text>
                <View style={styles.heroMetaItem}>
                  <Calendar size={14} color={Colors.text.secondary} />
                  <Text style={styles.heroMetaText}>{video.release_year}</Text>
                </View>
              </>
            )}
            {video && video.duration > 0 && (
              <>
                <Text style={styles.heroDot}>·</Text>
                <View style={styles.heroMetaItem}>
                  <Clock size={14} color={Colors.text.secondary} />
                  <Text style={styles.heroMetaText}>{formatDuration(video.duration)}</Text>
                </View>
              </>
            )}
            {video && (
              <>
                <Text style={styles.heroDot}>·</Text>
                <View style={styles.heroMetaItem}>
                  <Eye size={14} color={Colors.text.secondary} />
                  <Text style={styles.heroMetaText}>{formatViews(video.views_count)} views</Text>
                </View>
              </>
            )}
          </Animated.View>

          <Animated.Text key={`desc-${currentHeroIndex}`} entering={FadeInUp.delay(400).duration(400)} style={styles.heroDescription} numberOfLines={2}>
            {video?.description || 'Discover the best movies and shows curated just for you.'}
          </Animated.Text>

          <Animated.View key={`buttons-${currentHeroIndex}`} entering={FadeInUp.delay(500).duration(400)} style={styles.heroButtons}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => video && router.push(`/player/${video.id}`)}
              activeOpacity={0.9}
            >
              <Play size={22} color={Colors.text.primary} fill={Colors.text.primary} />
              <Text style={styles.playButtonText}>Watch Now</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.favButton, isFav && styles.favButtonActive]}
              onPress={() => toggleHeroFavorite(video)}
              activeOpacity={0.9}
            >
              <Animated.View entering={isFav ? ZoomIn.duration(300) : FadeIn.duration(200)}>
                {isFav ? <Check size={22} color={Colors.text.primary} /> : <Plus size={22} color={Colors.text.primary} />}
              </Animated.View>
              <Text style={styles.favButtonText}>
                {isFav ? 'In Favorites' : 'Add to Favorites'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        {featuredVideos.length > 1 && (
          <View style={styles.heroDots}>
            {featuredVideos.map((_, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => goToHeroSlide(index)}
                style={[styles.heroDotIndicator, index === currentHeroIndex && styles.heroDotIndicatorActive]}
                activeOpacity={0.7}
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
          <Text style={styles.appTitle}>StreamWorld</Text>
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
          {/* Continue Watching - only if user has watched videos */}
          {user && (continueWatching.length > 0 || loading) && (
            <VideoRow
              title="Continue Watching"
              videos={continueWatching}
              loading={loading}
              showProgress
              progressMap={continueWatchingProgress}
              onSeeAll={() => router.push('/history')}
              icon={Clock}
              emptyMessage="Continue watching will appear here after you start watching videos."
            />
          )}

          {/* Recommended For You */}
          <VideoRow
            title={recommendedReason}
            videos={recommendedVideos}
            loading={loading}
            onSeeAll={() => router.push('/search')}
            icon={Star}
            emptyMessage="No recommendations available yet. Start watching to get personalized suggestions."
          />

          {/* Trending Now */}
          <VideoRow
            title="Trending Now"
            videos={trendingVideos}
            loading={loading}
            onSeeAll={() => router.push('/search')}
            icon={TrendingUp}
            emptyMessage="No trending videos available yet."
          />

          {/* Recently Added */}
          <VideoRow
            title="Recently Added"
            videos={recentVideos}
            loading={loading}
            onSeeAll={() => router.push('/search')}
            icon={Sparkles}
            emptyMessage="No videos available yet."
          />

          {/* Most Watched */}
          <VideoRow
            title="Most Watched"
            videos={mostWatchedVideos}
            loading={loading}
            onSeeAll={() => router.push('/search')}
            icon={Eye}
            emptyMessage="No videos have been watched yet."
          />

          {/* Below-the-fold sections - lazy loaded */}
          {belowFoldReady && (
            <>
              {/* Category-based sections */}
              {categorySections.map((category) => (
                <VideoRow
                  key={`cat-${category.slug}`}
                  title={category.name}
                  videos={category.videos}
                  onSeeAll={() => router.push(`/category/${category.slug}`)}
                  emptyMessage={`No ${category.name} videos available yet.`}
                />
              ))}

              {/* Genre-based sections */}
              {genreSections.map((genre) => (
                <VideoRow
                  key={`genre-${genre.name}`}
                  title={genre.name}
                  videos={genre.videos}
                  onSeeAll={() => router.push('/search')}
                  emptyMessage={`No ${genre.name} videos available yet.`}
                />
              ))}
            </>
          )}

          {/* Skeleton for below-fold while loading */}
          {loading && !belowFoldReady && (
            <>
              <VideoRowSkeleton count={4} />
              <VideoRowSkeleton count={4} />
            </>
          )}
        </View>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatViews(views: number): string {
  if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
  if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
  return views.toString();
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
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
  topBarActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
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
  unreadBadgeText: { fontSize: 10, fontWeight: FontWeights.bold, color: Colors.text.primary },
  heroContainer: { width: '100%', height: height * 0.58, position: 'relative' },
  heroImage: { width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(11, 11, 11, 0.35)' },
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
  heroContent: { position: 'absolute', bottom: Spacing.xl, left: Spacing.lg, right: Spacing.lg },
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
  heroBadgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.primary, letterSpacing: 1.5 },
  heroTitle: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm },
  heroMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroMetaText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  heroDot: { fontSize: FontSizes.md, color: Colors.text.muted },
  heroDescription: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
    maxWidth: width * 0.85,
  },
  heroButtons: { flexDirection: 'row', gap: Spacing.md, flexWrap: 'wrap' },
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
  playButtonText: { color: Colors.text.primary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  favButton: {
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
  favButtonActive: { backgroundColor: 'rgba(34, 197, 94, 0.3)', borderColor: 'rgba(34, 197, 94, 0.5)' },
  favButtonText: { color: Colors.text.primary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
  heroDots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm, position: 'absolute', bottom: Spacing.sm, left: 0, right: 0 },
  heroDotIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  heroDotIndicatorActive: { backgroundColor: Colors.primary, width: 24 },
  contentContainer: { marginTop: Spacing.lg },
  footer: { height: Spacing.xxl },
});
