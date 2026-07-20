import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Users,
  Eye,
  ThumbsUp,
  Film,
  Play,
  Settings,
  Share2,
  Youtube,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Video, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { VideoCard } from '@/components/VideoCard';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

const BANNER_HEIGHT = 180;
const AVATAR_SIZE = 96;

export default function MyChannelScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    videoCount: 0,
    totalViews: 0,
    totalLikes: 0,
    subscribers: 0,
  });
  const [activeTab, setActiveTab] = useState<'videos' | 'shorts'>('videos');

  const fetchChannelData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [profileRes, videosRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('videos')
          .select('*')
          .eq('uploader_id', user.id)
          .eq('status', 'published')
          .order('created_at', { ascending: false }),
      ]);

      if (profileRes.error) throw profileRes.error;
      if (videosRes.error) throw videosRes.error;

      setProfile(profileRes.data as Profile);
      const userVideos = (videosRes.data as Video[]) || [];
      setVideos(userVideos);

      const videoIds = userVideos.map(v => v.id);
      let totalViews = userVideos.reduce((sum, v) => sum + (v.views_count || 0), 0);
      let totalLikes = 0;

      if (videoIds.length > 0) {
        const [viewsRes, likesRes] = await Promise.all([
          supabase
            .from('video_views')
            .select('id', { count: 'exact', head: true })
            .in('video_id', videoIds),
          supabase
            .from('video_likes')
            .select('id', { count: 'exact', head: true })
            .in('video_id', videoIds),
        ]);

        if (viewsRes.count !== null) totalViews = viewsRes.count;
        if (likesRes.count !== null) totalLikes = likesRes.count;
      }

      setStats({
        videoCount: userVideos.length,
        totalViews,
        totalLikes,
        subscribers: 0,
      });
    } catch (error) {
      console.error('Error fetching channel data:', error);
      toast.error('Failed to load channel', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchChannelData();
  }, [fetchChannelData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchChannelData();
    setRefreshing(false);
  }, [fetchChannelData]);

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const filteredVideos = activeTab === 'shorts'
    ? videos.filter(v => v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60))
    : videos.filter(v => !(v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60)));

  const renderVideo = ({ item, index }: { item: Video; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={styles.videoItem}
    >
      <VideoCard video={item} size="medium" onPress={() => router.push(`/player/${item.id}`)} />
    </Animated.View>
  );

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Channel</Text>
          </View>
          <EmptyState
            type="custom"
            icon={<Youtube size={64} color={Colors.text.muted} />}
            title="Sign in to view your channel"
            message="Every creator has a channel. Sign in to showcase your videos, shorts, and stats."
            onAction={() => router.push('/auth/login')}
            actionLabel="Sign In"
          />
        </View>
      </>
    );
  }

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Channel</Text>
          </View>
          <View style={styles.skeletonBanner} />
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonInfo} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Channel</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.headerIcon} onPress={() => toast.info('Coming soon', 'Sharing is not available yet')}>
                <Share2 size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerIcon} onPress={() => router.push('/profile/edit')}>
                <Settings size={20} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bannerContainer}>
            {profile?.banner_url ? (
              <Image source={{ uri: profile.banner_url }} style={styles.banner} resizeMode="cover" />
            ) : (
              <View style={styles.bannerPlaceholder} />
            )}
            <View style={styles.bannerOverlay} />
          </View>

          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>{profile?.full_name || 'Anonymous Creator'}</Text>
              <Text style={styles.username}>@{profile?.username || profile?.email?.split('@')[0]}</Text>
              <Text style={styles.joinedDate}>
                Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : 'Recently'}
              </Text>
            </View>
          </View>

          {profile?.bio ? (
            <View style={styles.bioContainer}>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          ) : null}

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Film size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{formatCount(stats.videoCount)}</Text>
              <Text style={styles.statLabel}>Videos</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Eye size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{formatCount(stats.totalViews)}</Text>
              <Text style={styles.statLabel}>Views</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <ThumbsUp size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{formatCount(stats.totalLikes)}</Text>
              <Text style={styles.statLabel}>Likes</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Users size={18} color={Colors.primary} />
              <Text style={styles.statValue}>{formatCount(stats.subscribers)}</Text>
              <Text style={styles.statLabel}>Subs</Text>
            </View>
          </View>

          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'videos' && styles.tabActive]}
              onPress={() => setActiveTab('videos')}
            >
              <Play size={16} color={activeTab === 'videos' ? Colors.primary : Colors.text.muted} />
              <Text style={[styles.tabText, activeTab === 'videos' && styles.tabTextActive]}>Videos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'shorts' && styles.tabActive]}
              onPress={() => setActiveTab('shorts')}
            >
              <Film size={16} color={activeTab === 'shorts' ? Colors.primary : Colors.text.muted} />
              <Text style={[styles.tabText, activeTab === 'shorts' && styles.tabTextActive]}>Shorts</Text>
            </TouchableOpacity>
          </View>

          {filteredVideos.length === 0 ? (
            <View style={styles.emptyContainer}>
              <EmptyState
                type="custom"
                icon={<Film size={64} color={Colors.text.muted} />}
                title={activeTab === 'shorts' ? 'No shorts yet' : 'No videos uploaded'}
                message={activeTab === 'shorts' ? 'Upload short vertical videos to see them here.' : 'Upload your first video to start building your channel.'}
                onAction={() => router.push('/admin/upload')}
                actionLabel="Upload Video"
              />
            </View>
          ) : (
            <FlatList
              data={filteredVideos}
              keyExtractor={(item) => item.id}
              renderItem={renderVideo}
              numColumns={2}
              columnWrapperStyle={styles.videoRow}
              scrollEnabled={false}
              contentContainerStyle={styles.videoList}
            />
          )}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 50,
    paddingBottom: Spacing.sm,
    zIndex: 10,
  },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginLeft: Spacing.sm },
  headerActions: { flexDirection: 'row', gap: Spacing.sm },
  headerIcon: { padding: Spacing.xs },
  bannerContainer: { width: '100%', height: BANNER_HEIGHT, position: 'relative' },
  banner: { width: '100%', height: '100%' },
  bannerPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.secondary,
  alignItems: 'center',
    justifyContent: 'center',
  },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: 'rgba(11,11,11,0.6)',
  },
  profileSection: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.lg,
    marginTop: -AVATAR_SIZE / 2,
  },
  avatarContainer: {
    marginRight: Spacing.md,
    borderRadius: AVATAR_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: Colors.background,
  },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 },
  avatarPlaceholder: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  profileInfo: { flex: 1, paddingBottom: Spacing.xs },
  displayName: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  username: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  joinedDate: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 4 },
  bioContainer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  bioText: { fontSize: FontSizes.md, color: Colors.text.secondary, lineHeight: 22 },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statItem: { alignItems: 'center', gap: 4 },
  statValue: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  statLabel: { fontSize: FontSizes.xs, color: Colors.text.muted },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)', borderColor: 'rgba(229, 9, 20, 0.3)' },
  tabText: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  videoList: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  videoRow: { justifyContent: 'space-between', marginBottom: Spacing.md },
  videoItem: { width: (width - Spacing.lg * 3) / 2 },
  emptyContainer: { paddingTop: Spacing.xl },
  skeletonBanner: { width: '100%', height: BANNER_HEIGHT, backgroundColor: Colors.secondary },
  skeletonAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: Colors.tertiary,
    marginTop: -AVATAR_SIZE / 2,
    marginLeft: Spacing.lg,
    borderWidth: 4,
    borderColor: Colors.background,
  },
  skeletonInfo: { padding: Spacing.lg, gap: Spacing.sm },
});
