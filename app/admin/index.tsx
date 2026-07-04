import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  Film,
  Users,
  Eye,
  CloudUpload,
  Clapperboard,
  Tag,
  ChartBar,
  Settings,
  Bell,
  Star,
  LogOut,
  ChevronRight,
  AlertCircle,
  TrendingUp,
  Calendar,
  Clock,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/Loading';
import { AdminDashboardSkeleton } from '@/components/Skeleton';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 2 - Spacing.md) / 2;

interface DashboardStats {
  totalVideos: number;
  publishedVideos: number;
  draftVideos: number;
  totalUsers: number;
  totalViews: number;
  viewsToday: number;
  viewsThisWeek: number;
  viewsThisMonth: number;
  recentVideos: Video[];
  featuredVideos: Video[];
  trendingVideos: Video[];
  topVideos: Video[];
  recentSignups: number;
  storageUsed: string;
  dailyViews: { date: string; views: number }[];
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user, profile, isAdmin, loading: authLoading, signOut } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month'>('week');

  const fetchStats = useCallback(async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [
        videosCount,
        publishedCount,
        draftCount,
        usersCount,
        viewsCount,
        viewsToday,
        viewsWeek,
        viewsMonth,
        recentVideosData,
        featuredVideosData,
        trendingVideosData,
        topVideosData,
        recentSignups,
        dailyViewsData,
      ] = await Promise.all([
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('video_views').select('id', { count: 'exact', head: true }),
        supabase.from('video_views').select('id', { count: 'exact', head: true }).gte('viewed_at', todayStart),
        supabase.from('video_views').select('id', { count: 'exact', head: true }).gte('viewed_at', weekAgo),
        supabase.from('video_views').select('id', { count: 'exact', head: true }).gte('viewed_at', monthAgo),
        supabase.from('videos').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('videos').select('*').eq('featured', true).eq('status', 'published').limit(4),
        supabase.from('videos').select('*').eq('trending', true).eq('status', 'published').limit(4),
        supabase.from('videos').select('*').eq('status', 'published').order('views_count', { ascending: false }).limit(5),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
        supabase.from('video_views').select('viewed_at').gte('viewed_at', weekAgo),
      ]);

      // Process daily views for chart
      const dailyViewsMap = new Map<string, number>();
      if (dailyViewsData.data) {
        dailyViewsData.data.forEach((view: any) => {
          const date = new Date(view.viewed_at).toISOString().split('T')[0];
          dailyViewsMap.set(date, (dailyViewsMap.get(date) || 0) + 1);
        });
      }

      // Generate last 7 days
      const dailyViews: { date: string; views: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailyViews.push({
          date: dateStr,
          views: dailyViewsMap.get(dateStr) || 0,
        });
      }

      setStats({
        totalVideos: videosCount.count || 0,
        publishedVideos: publishedCount.count || 0,
        draftVideos: draftCount.count || 0,
        totalUsers: usersCount.count || 0,
        totalViews: viewsCount.count || 0,
        viewsToday: viewsToday.count || 0,
        viewsThisWeek: viewsWeek.count || 0,
        viewsThisMonth: viewsMonth.count || 0,
        recentVideos: (recentVideosData.data as Video[]) || [],
        featuredVideos: (featuredVideosData.data as Video[]) || [],
        trendingVideos: (trendingVideosData.data as Video[]) || [],
        topVideos: (topVideosData.data as Video[]) || [],
        recentSignups: recentSignups.count || 0,
        storageUsed: 'Calculating...',
        dailyViews,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;

    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }

    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [authLoading, user, isAdmin, router, fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <AlertCircle size={48} color={Colors.status.error} />
          <Text style={styles.unauthorizedTitle}>Access Denied</Text>
          <Text style={styles.unauthorizedText}>You must be logged in as an admin to access this page.</Text>
          <TouchableOpacity style={styles.loginButton} onPress={() => router.replace('/admin/login')}>
            <Text style={styles.loginButtonText}>Go to Admin Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading && !stats) {
    return (
      <View style={styles.container}>
        <AdminDashboardSkeleton />
      </View>
    );
  }

  const statCards = [
    {
      icon: Film,
      label: 'Total Videos',
      value: stats?.totalVideos || 0,
      subtext: `${stats?.publishedVideos || 0} published`,
      color: Colors.primary,
      onPress: () => router.push('/admin/videos'),
    },
    {
      icon: Users,
      label: 'Total Users',
      value: stats?.totalUsers || 0,
      subtext: `+${stats?.recentSignups || 0} this week`,
      color: Colors.status.info,
      onPress: () => router.push('/admin/users'),
    },
    {
      icon: Eye,
      label: 'Total Views',
      value: stats?.totalViews || 0,
      subtext: `${formatNumber(stats?.viewsThisWeek || 0)} this week`,
      color: Colors.status.success,
      onPress: () => router.push('/admin/analytics'),
    },
    {
      icon: Star,
      label: 'Featured',
      value: (stats?.featuredVideos.length || 0) + (stats?.trendingVideos.length || 0),
      subtext: 'Featured + Trending',
      color: Colors.status.warning,
      onPress: () => router.push('/admin/videos'),
    },
  ];

  const menuItems = [
    { icon: CloudUpload, label: 'Upload Video', route: '/admin/upload', color: Colors.primary, description: 'Add new content' },
    { icon: Clapperboard, label: 'Manage Videos', route: '/admin/videos', color: Colors.status.info, description: `${stats?.totalVideos || 0} videos` },
    { icon: Tag, label: 'Categories', route: '/admin/categories', color: Colors.status.success, description: 'Organize content' },
    { icon: Users, label: 'Users', route: '/admin/users', color: Colors.status.warning, description: `${stats?.totalUsers || 0} users` },
    { icon: ChartBar, label: 'Analytics', route: '/admin/analytics', color: Colors.status.error, description: 'View statistics' },
    { icon: Bell, label: 'Notifications', route: '/notifications', color: '#A855F7', description: 'Manage alerts' },
    { icon: Settings, label: 'Settings', route: '/admin/settings', color: Colors.text.secondary, description: 'Configure app' },
  ];

  const getTimeFilteredViews = () => {
    switch (timeFilter) {
      case 'today': return stats?.viewsToday || 0;
      case 'month': return stats?.viewsThisMonth || 0;
      default: return stats?.viewsThisWeek || 0;
    }
  };

  const renderBarChart = () => {
    if (!stats?.dailyViews || stats.dailyViews.length === 0) return null;

    const maxViews = Math.max(...stats.dailyViews.map(d => d.views), 1);
    const barWidth = (width - Spacing.lg * 2 - Spacing.sm * 6) / 7;

    return (
      <View style={styles.chartContainer}>
        <View style={styles.barsRow}>
          {stats.dailyViews.map((day, index) => {
            const barHeight = Math.max(4, (day.views / maxViews) * 120);
            const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
            return (
              <Animated.View
                key={day.date}
                entering={FadeInUp.delay(index * 50).duration(300)}
                style={styles.barWrapper}
              >
                <View style={styles.barColumn}>
                  <View style={[styles.bar, { height: barHeight }]} />
                  <Text style={styles.barValue}>{day.views > 0 ? day.views : ''}</Text>
                </View>
                <Text style={styles.barLabel}>{dayLabel}</Text>
              </Animated.View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderTopVideosChart = () => {
    if (!stats?.topVideos || stats.topVideos.length === 0) return null;

    const maxViews = Math.max(...stats.topVideos.slice(0, 5).map(v => v.views_count), 1);

    return (
      <View style={styles.horizontalChart}>
        {stats.topVideos.slice(0, 5).map((video, index) => {
          const barWidth = Math.max(20, (video.views_count / maxViews) * 100);
          return (
            <View key={video.id} style={styles.horizontalBarRow}>
              <Text style={styles.horizontalBarLabel} numberOfLines={1}>{index + 1}. {video.title}</Text>
              <View style={styles.horizontalBarTrack}>
                <Animated.View
                  entering={FadeIn.delay(index * 100).duration(400)}
                  style={[styles.horizontalBarFill, { width: `${barWidth}%` }]}
                />
              </View>
              <Text style={styles.horizontalBarValue}>{formatNumber(video.views_count)}</Text>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Admin Dashboard</Text>
            <Text style={styles.subtitle}>Welcome, {profile?.full_name || profile?.email?.split('@')[0] || 'Admin'}</Text>
          </View>
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <LogOut size={20} color={Colors.status.error} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* Stats Grid */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.statsGrid}>
          {statCards.map((stat, index) => (
            <TouchableOpacity
              key={index}
              style={styles.statCard}
              onPress={stat.onPress}
              activeOpacity={0.8}
            >
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <stat.icon size={22} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{formatNumber(stat.value)}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
              {stat.subtext && <Text style={styles.statSubtext}>{stat.subtext}</Text>}
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Views Analytics Card with Chart */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <View style={styles.analyticsTitleRow}>
              <TrendingUp size={18} color={Colors.primary} />
              <Text style={styles.analyticsTitle}>Video Views</Text>
            </View>
            <View style={styles.timeFilterTabs}>
              {(['today', 'week', 'month'] as const).map((filter) => (
                <TouchableOpacity
                  key={filter}
                  style={[styles.timeFilterTab, timeFilter === filter && styles.timeFilterTabActive]}
                  onPress={() => setTimeFilter(filter)}
                >
                  <Text style={[styles.timeFilterText, timeFilter === filter && styles.timeFilterTextActive]}>
                    {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <Text style={styles.analyticsValue}>{formatNumber(getTimeFilteredViews())}</Text>
          <Text style={styles.analyticsSubtext}>Total: {formatNumber(stats?.totalViews || 0)} all time</Text>

          {/* Weekly Views Bar Chart */}
          {timeFilter === 'week' && renderBarChart()}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => router.push(item.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                  <item.icon size={20} color={item.color} />
                </View>
                <View style={styles.menuContent}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDescription}>{item.description}</Text>
                </View>
                <ChevronRight size={18} color={Colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Top Videos Chart */}
        {stats?.topVideos && stats.topVideos.length > 0 && (
          <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Performing Videos</Text>
              <TouchableOpacity onPress={() => router.push('/admin/analytics')}>
                <Text style={styles.seeAllText}>Analytics</Text>
              </TouchableOpacity>
            </View>
            {renderTopVideosChart()}
          </Animated.View>
        )}

        {/* Featured Videos */}
        {stats?.featuredVideos && stats.featuredVideos.length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Videos</Text>
              <TouchableOpacity onPress={() => router.push('/admin/videos')}>
                <Text style={styles.seeAllText}>Manage</Text>
              </TouchableOpacity>
            </View>
            {stats.featuredVideos.map((video) => (
              <View key={video.id} style={styles.videoItem}>
                <View style={styles.videoThumbnail}>
                  <Film size={16} color={Colors.text.secondary} />
                </View>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle} numberOfLines={1}>{video.title}</Text>
                  <Text style={styles.videoMeta}>{video.views_count || 0} views</Text>
                </View>
                <Star size={16} color={Colors.primary} fill={Colors.primary} />
              </View>
            ))}
          </Animated.View>
        )}

        {/* Recently Uploaded */}
        {stats?.recentVideos && stats.recentVideos.length > 0 && (
          <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recently Uploaded</Text>
              <TouchableOpacity onPress={() => router.push('/admin/videos')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {stats.recentVideos.map((video) => (
              <TouchableOpacity key={video.id} style={styles.videoItem} onPress={() => router.push(`/video/${video.id}`)} activeOpacity={0.7}>
                <View style={styles.videoThumbnail}>
                  <Film size={16} color={Colors.text.secondary} />
                </View>
                <View style={styles.videoInfo}>
                  <Text style={styles.videoTitle} numberOfLines={1}>{video.title}</Text>
                  <View style={styles.videoTags}>
                    {video.featured && <View style={[styles.badge, styles.badgeFeatured]}><Text style={styles.badgeText}>Featured</Text></View>}
                    {video.trending && <View style={[styles.badge, styles.badgeTrending]}><Text style={styles.badgeText}>Trending</Text></View>}
                  </View>
                </View>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, video.status === 'published' ? styles.statusPublished : styles.statusDraft]} />
                  <Text style={styles.statusText}>{video.status}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: FontWeights.bold, color: Colors.text.primary },
  subtitle: { fontSize: FontSizes.md, color: Colors.text.secondary, marginTop: 4 },
  signOutButton: { padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  content: { flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, justifyContent: 'space-between' },
  statCard: { width: CARD_WIDTH, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.border },
  statIcon: { width: 40, height: 40, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: 24, fontWeight: FontWeights.bold, color: Colors.text.primary },
  statLabel: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: 4 },
  statSubtext: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 4 },
  analyticsCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  analyticsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  analyticsTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  timeFilterTabs: { flexDirection: 'row', gap: Spacing.xs, backgroundColor: Colors.tertiary, padding: 3, borderRadius: BorderRadius.md },
  timeFilterTab: { paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm },
  timeFilterTabActive: { backgroundColor: Colors.primary },
  timeFilterText: { fontSize: FontSizes.xs, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  timeFilterTextActive: { color: Colors.text.primary },
  analyticsValue: { fontSize: 36, fontWeight: FontWeights.bold, color: Colors.text.primary },
  analyticsSubtext: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 4 },
  chartContainer: { marginTop: Spacing.lg, paddingHorizontal: Spacing.xs },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 160, paddingBottom: Spacing.sm },
  barWrapper: { alignItems: 'center', flex: 1 },
  barColumn: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  bar: { width: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, minHeight: 4 },
  barValue: { fontSize: FontSizes.xs, color: Colors.text.secondary, marginTop: 4, fontWeight: FontWeights.medium },
  barLabel: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.xs },
  horizontalChart: { marginTop: Spacing.sm },
  horizontalBarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm, gap: Spacing.sm },
  horizontalBarLabel: { fontSize: FontSizes.sm, color: Colors.text.primary, width: 100, flexShrink: 1 },
  horizontalBarTrack: { flex: 1, height: 8, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.sm, overflow: 'hidden' },
  horizontalBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.sm },
  horizontalBarValue: { fontSize: FontSizes.xs, color: Colors.text.muted, width: 50, textAlign: 'right' },
  section: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, marginTop: Spacing.md },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  seeAllText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  menuGrid: { gap: Spacing.sm },
  menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  menuIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  menuDescription: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  videoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  videoRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  videoRankText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  videoThumbnail: { width: 44, height: 44, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  videoInfo: { flex: 1 },
  videoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 2 },
  videoMeta: { fontSize: FontSizes.sm, color: Colors.text.muted },
  videoTags: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 4 },
  badge: { paddingHorizontal: Spacing.xs, paddingVertical: 2, borderRadius: BorderRadius.sm },
  badgeFeatured: { backgroundColor: Colors.primary },
  badgeTrending: { backgroundColor: Colors.status.info },
  badgeText: { fontSize: FontSizes.xs, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  videoBadge: { paddingVertical: 4, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm },
  videoBadgeText: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusPublished: { backgroundColor: Colors.status.success },
  statusDraft: { backgroundColor: Colors.text.muted },
  statusText: { fontSize: FontSizes.xs, color: Colors.text.muted, textTransform: 'capitalize' },
  footer: { height: Spacing.xxl },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  unauthorizedTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  unauthorizedText: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center' },
  loginButton: { marginTop: Spacing.lg, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  loginButtonText: { color: Colors.text.primary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
});
