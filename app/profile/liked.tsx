import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { ThumbsUp } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { VideoCard } from '@/components/VideoCard';
import { VideoCardSkeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { SubPageHeader } from '@/components/SubPageHeader';
import { Colors, Spacing } from '@/constants/theme';

const { width } = Dimensions.get('window');

export default function LikedVideosScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLikedVideos = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('video_likes')
        .select('video_id, created_at, videos(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const fetched = data
          .filter((item) => item.videos && !Array.isArray(item.videos))
          .map((item) => item.videos as unknown as Video);
        setVideos(fetched);
      }
    } catch (error) {
      console.error('Error fetching liked videos:', error);
      toast.error('Failed to load', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchLikedVideos();
  }, [fetchLikedVideos]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLikedVideos();
    setRefreshing(false);
  }, [fetchLikedVideos]);

  if (loading) {
    return (
      <View style={styles.container}>
        <SubPageHeader title="Liked Videos" subtitle="Videos you've enjoyed" />
        <View style={styles.grid}>
          {[1, 2, 3, 4].map((i) => (
            <View key={i} style={styles.gridItem}>
              <VideoCardSkeleton size="medium" />
            </View>
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <SubPageHeader title="Liked Videos" subtitle={`${videos.length} videos`} />

      {videos.length === 0 ? (
        <EmptyState
          type="custom"
          icon={<ThumbsUp size={64} color={Colors.text.muted} />}
          title="No liked videos yet"
          message="Like videos by tapping the thumbs-up icon while watching. They'll show up here."
          onAction={() => router.push('/')}
          actionLabel="Browse Videos"
        />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
              <VideoCard video={item} size="medium" onPress={() => router.push(`/player/${item.id}`)} />
            </Animated.View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: Spacing.md },
  gridItem: { width: (width - Spacing.md * 3) / 2 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
});
