import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import {
  Play,
  Heart,
  Clock,
  Star,
  ChevronDown,
  ChevronUp,
  User,
  Calendar,
  Eye,
  ArrowLeft,
} from 'lucide-react-native';
import { supabase, Video, Category } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { VideoRow } from '@/components/VideoRow';
import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/Loading';
import { CachedImage } from '@/components/CachedImage';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

const { width, height } = Dimensions.get('window');

export default function VideoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [video, setVideo] = useState<Video | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [relatedVideos, setRelatedVideos] = useState<Video[]>([]);
  const [watchProgress, setWatchProgress] = useState(0);
  const [inFavorites, setInFavorites] = useState(false);
  const [loading, setLoading] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [addingToFavorites, setAddingToFavorites] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;

    try {
      // Fetch video first
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', id)
        .eq('status', 'published')
        .maybeSingle();

      if (videoError || !videoData) {
        setLoading(false);
        return;
      }

      setVideo(videoData);

      // Parallelize all secondary queries
      const [categoryRes, relatedRes, historyRes, favoriteRes] = await Promise.all([
        supabase.from('video_categories').select('categories(*)').eq('video_id', id),
        videoData.genre
          ? supabase.from('videos').select('*').eq('status', 'published').neq('id', id).eq('genre', videoData.genre).limit(10)
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('watch_history').select('progress').eq('video_id', id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
        user
          ? supabase.from('favorites').select('id').eq('video_id', id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (categoryRes.data) {
        const cats = categoryRes.data
          .filter((c) => c.categories && !Array.isArray(c.categories))
          .map((c) => c.categories as unknown as Category);
        setCategories(cats);
      }

      if (relatedRes.data) setRelatedVideos(relatedRes.data);

      if (historyRes.data && videoData) {
        setWatchProgress(videoData.duration > 0 ? Math.min(100, (historyRes.data.progress / videoData.duration) * 100) : 0);
      }

      setInFavorites(!!favoriteRes.data);

      // Track view (deduplicate: only count once per hour per user)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existingView } = await supabase
        .from('video_views')
        .select('id')
        .eq('video_id', id)
        .gte('viewed_at', oneHourAgo)
        .limit(1)
        .maybeSingle();

      if (!existingView) {
        await Promise.all([
          supabase.from('video_views').insert({
            video_id: id,
            user_id: user?.id || null,
            watch_duration: 0,
          }),
          supabase.rpc('increment_video_views', { video_id: id }),
        ]);
      }
    } catch (error) {
      console.error('Error fetching video:', error);
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const toggleFavorites = async () => {
    if (!user || !video || addingToFavorites) return;

    const wasFav = inFavorites;
    // Instant UI update (optimistic)
    setInFavorites(!wasFav);
    setAddingToFavorites(true);

    try {
      if (wasFav) {
        await supabase
          .from('favorites')
          .delete()
          .eq('video_id', video.id)
          .eq('user_id', user.id);
      } else {
        await supabase.from('favorites').insert({
          video_id: video.id,
          user_id: user.id,
        });
      }
    } catch (error) {
      // Revert on failure
      setInFavorites(wasFav);
      console.error('Error toggling favorites:', error);
    } finally {
      setAddingToFavorites(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!video) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Video not found</Text>
        <Button title="Go Back" onPress={handleBack} />
      </View>
    );
  }

  const duration = formatDuration(video.duration);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroContainer}>
          <CachedImage
            uri={video.thumbnail_url || 'https://images.unsplash.com/photo-1489594927165-fd5a049b6667?w=800&h=450&fit=crop'}
            fallbackUri="https://picsum.photos/seed/placeholder/800/450"
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.heroContent}>
            <TouchableOpacity
              style={styles.playButtonLarge}
              onPress={() => router.push(`/player/${video.id}`)}
            >
              <Play size={48} color={Colors.text.primary} fill={Colors.text.primary} />
            </TouchableOpacity>
          </View>
          {watchProgress > 0 && (
            <View style={styles.heroProgress}>
              <View style={styles.heroProgressBar}>
                <View style={[styles.heroProgressFill, { width: `${watchProgress}%` }]} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>{video.title}</Text>

          <View style={styles.metaContainer}>
            {video.release_year && (
              <View style={styles.metaItem}>
                <Calendar size={14} color={Colors.text.secondary} />
                <Text style={styles.metaText}>{video.release_year}</Text>
              </View>
            )}
            <View style={styles.metaItem}>
              <Clock size={14} color={Colors.text.secondary} />
              <Text style={styles.metaText}>{duration}</Text>
            </View>
            {video.views_count > 0 && (
              <View style={styles.metaItem}>
                <Eye size={14} color={Colors.text.secondary} />
                <Text style={styles.metaText}>{formatViews(video.views_count)} views</Text>
              </View>
            )}
            {video.rating && (
              <View style={styles.metaItem}>
                <Star size={14} color="#FFD700" />
                <Text style={styles.metaText}>{video.rating}</Text>
              </View>
            )}
          </View>

          {categories.length > 0 && (
            <View style={styles.categoriesContainer}>
              {categories.map((cat) => (
                <TouchableOpacity key={cat.id} style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{cat.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.actionButtons}>
            <Button
              title="Play"
              onPress={() => router.push(`/player/${video.id}`)}
              icon={<Play size={20} color={Colors.text.primary} fill={Colors.text.primary} />}
              style={styles.playAction}
            />
            <TouchableOpacity
              style={[styles.favoriteButton, inFavorites && styles.favoriteActive]}
              onPress={toggleFavorites}
              disabled={addingToFavorites || !user}
            >
              <Heart
                size={24}
                color={inFavorites ? Colors.primary : Colors.text.primary}
                fill={inFavorites ? Colors.primary : 'transparent'}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.descriptionContainer}
              onPress={() => setDescriptionExpanded(!descriptionExpanded)}
            >
              <Text
                style={styles.description}
                numberOfLines={descriptionExpanded ? undefined : 3}
              >
                {video.description || 'No description available for this video.'}
              </Text>
              {video.description && video.description.length > 150 && (
                <View style={styles.readMore}>
                  {descriptionExpanded ? (
                    <ChevronUp size={20} color={Colors.primary} />
                  ) : (
                    <ChevronDown size={20} color={Colors.primary} />
                  )}
                  <Text style={styles.readMoreText}>
                    {descriptionExpanded ? 'Show less' : 'Read more'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {video.video_cast && video.video_cast.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cast</Text>
              <View style={styles.castContainer}>
                {video.video_cast.map((member, index) => (
                  <View key={index} style={styles.castItem}>
                    <View style={styles.castAvatar}>
                      <User size={20} color={Colors.text.muted} />
                    </View>
                    <Text style={styles.castName}>{member}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {video.director && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Director</Text>
              <Text style={styles.directorText}>{video.director}</Text>
            </View>
          )}

          {relatedVideos.length > 0 && (
            <VideoRow
              title="Related Videos"
              videos={relatedVideos}
              onSeeAll={() => router.push('/search')}
            />
          )}
        </View>
      </ScrollView>
    </>
  );
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m ${secs}s`;
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
    flex: 1,
    backgroundColor: Colors.background,
  },
  heroContainer: {
    width: '100%',
    height: height * 0.42,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 11, 11, 0.5)',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroContent: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -32 }, { translateY: -32 }],
  },
  playButtonLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.text.primary,
  },
  heroProgress: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  heroProgressBar: {
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  heroProgressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
  },
  content: {
    padding: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  title: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  metaContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  metaText: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  categoryBadge: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.full,
  },
  categoryText: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    fontWeight: FontWeights.medium,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  playAction: {
    flex: 1,
  },
  favoriteButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  favoriteActive: {
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
    borderColor: Colors.primary,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  descriptionContainer: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  description: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 24,
  },
  readMore: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  readMoreText: {
    fontSize: FontSizes.sm,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
  castContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  castItem: {
    alignItems: 'center',
    width: 80,
  },
  castAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  castName: {
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  directorText: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  errorText: {
    fontSize: FontSizes.xl,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
});
