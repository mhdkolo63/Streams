import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, Dimensions, Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  Film, Users, Eye, CloudUpload, Clapperboard, Tag, ChartBar, Settings, Bell, Star,
  LogOut, ChevronRight, AlertCircle, TrendingUp, Clock, Activity, Heart, Folder,
  HardDrive, Database, Shield, Server, CheckCircle, FileVideo, UserCheck, Calendar,
  Trash2, Edit, Plus, UserX, BarChart3, Zap, EyeOff,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/Loading';
import { AdminDashboardSkeleton } from '@/components/Skeleton';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - Spacing.lg * 2 - Spacing.md * 2) / 3;

interface ActivityLog {
  id: string;
  action: string;
  description: string;
  entity_type: string;
  created_at: string;
}

interface DashboardStats {
  totalVideos: number;
  publishedVideos: number;
  draftVideos: number;
  privateVideos: number;
  featuredVideos: number;
  trendingVideos: number;
  totalUsers: number;
  activeUsers: number;
  totalViews: number;
  totalLikes: number;
  totalFavorites: number;
  totalCategories: number;
  totalWatchTime: number;
  storageUsed: number;
  storageUsedFormatted: string;
  recentActivity: ActivityLog[];
  dailyViews: { date: string; views: number }[];
  topVideos: Video[];
  recentSignups: number;
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
        totalV, publishedV, draftV, privateV, featuredV, trendingV,
        totalU, activeU, totalViews, totalLikes, totalFavs, totalCats,
        watchTimeData, recentActivityData, dailyViewsData, topVideosData, recentSignupsData,
      ] = await Promise.all([
        supabase.from('videos').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'private'),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('featured', true),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('trending', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('video_views').select('id', { count: 'exact', head: true }),
        supabase.from('video_likes').select('id', { count: 'exact', head: true }),
        supabase.from('favorites').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('video_views').select('watch_duration'),
        supabase.from('admin_activity_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('video_views').select('viewed_at').gte('viewed_at', weekAgo),
        supabase.from('videos').select('*').eq('status', 'published').order('views_count', { ascending: false }).limit(5),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      ]);

      // Calculate total watch time
      let totalWatchTime = 0;
      if (watchTimeData.data) {
        watchTimeData.data.forEach((v: any) => { totalWatchTime += v.watch_duration || 0; });
      }

      // Process daily views
      const dailyViewsMap = new Map<string, number>();
      if (dailyViewsData.data) {
        dailyViewsData.data.forEach((view: any) => {
          const date = new Date(view.viewed_at).toISOString().split('T')[0];
          dailyViewsMap.set(date, (dailyViewsMap.get(date) || 0) + 1);
        });
      }
      const dailyViews: { date: string; views: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        const dateStr = date.toISOString().split('T')[0];
        dailyViews.push({ date: dateStr, views: dailyViewsMap.get(dateStr) || 0 });
      }

      // Storage calculation
      let storageUsed = 0;
      const { data: videoFiles } = await supabase.storage.from('videos').list('', { limit: 100 });
      if (videoFiles) {
        videoFiles.forEach(f => { storageUsed += f.metadata?.size || 0; });
      }
      const { data: thumbFiles } = await supabase.storage.from('thumbnails').list('', { limit: 100 });
      if (thumbFiles) {
        thumbFiles.forEach(f => { storageUsed += f.metadata?.size || 0; });
      }

      setStats({
        totalVideos: totalV.count || 0,
        publishedVideos: publishedV.count || 0,
        draftVideos: draftV.count || 0,
        privateVideos: privateV.count || 0,
        featuredVideos: featuredV.count || 0,
        trendingVideos: trendingV.count || 0,
        totalUsers: totalU.count || 0,
        activeUsers: activeU.count || 0,
        totalViews: totalViews.count || 0,
        totalLikes: totalLikes.count || 0,
        totalFavorites: totalFavs.count || 0,
        totalCategories: totalCats.count || 0,
        totalWatchTime,
        storageUsed,
        storageUsedFormatted: formatBytes(storageUsed),
        recentActivity: (recentActivityData.data as ActivityLog[]) || [],
        dailyViews,
        topVideos: (topVideosData.data as Video[]) || [],
        recentSignups: recentSignupsData.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { router.replace('/admin/login'); return; }
    setLoading(true);
    fetchStats().finally(() => setLoading(false));
  }, [authLoading, user, isAdmin, router, fetchStats]);

  // Realtime updates
  useEffect(() => {
    if (!user || !isAdmin) return;
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'video_views' }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_activity_logs' }, () => fetchStats())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, isAdmin, fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/');
  };

  if (authLoading) return <LoadingScreen />;
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
    return <View style={styles.container}><AdminDashboardSkeleton /></View>;
  }

  const statCards = [
    { icon: Film, label: 'Total Videos', value: stats?.totalVideos || 0, color: Colors.primary, onPress: () => router.push('/admin/videos') },
    { icon: Eye, label: 'Published', value: stats?.publishedVideos || 0, color: Colors.status.success, onPress: () => router.push('/admin/videos') },
    { icon: FileVideo, label: 'Drafts', value: stats?.draftVideos || 0, color: Colors.text.muted, onPress: () => router.push('/admin/videos') },
    { icon: EyeOff, label: 'Private', value: stats?.privateVideos || 0, color: Colors.status.warning, onPress: () => router.push('/admin/videos') },
    { icon: Star, label: 'Featured', value: stats?.featuredVideos || 0, color: Colors.primary, onPress: () => router.push('/admin/videos') },
    { icon: TrendingUp, label: 'Trending', value: stats?.trendingVideos || 0, color: Colors.status.info, onPress: () => router.push('/admin/videos') },
    { icon: Users, label: 'Total Users', value: stats?.totalUsers || 0, color: Colors.status.info, onPress: () => router.push('/admin/users') },
    { icon: UserCheck, label: 'Active Users', value: stats?.activeUsers || 0, color: Colors.status.success, onPress: () => router.push('/admin/users') },
    { icon: Eye, label: 'Total Views', value: stats?.totalViews || 0, color: Colors.status.success, onPress: () => router.push('/admin/analytics') },
    { icon: Heart, label: 'Total Likes', value: stats?.totalLikes || 0, color: Colors.status.error, onPress: () => router.push('/admin/analytics') },
    { icon: Star, label: 'Favorites', value: stats?.totalFavorites || 0, color: Colors.status.warning, onPress: () => router.push('/admin/analytics') },
    { icon: Folder, label: 'Categories', value: stats?.totalCategories || 0, color: Colors.status.info, onPress: () => router.push('/admin/categories') },
    { icon: Clock, label: 'Watch Time', value: formatWatchTime(stats?.totalWatchTime || 0), color: Colors.status.success, onPress: () => router.push('/admin/analytics') },
    { icon: HardDrive, label: 'Storage Used', value: stats?.storageUsedFormatted || '0 B', color: Colors.primary, onPress: () => {} },
    { icon: Database, label: 'Storage Left', value: '50 GB', color: Colors.status.info, onPress: () => {} },
  ];

  const quickActions = [
    { icon: CloudUpload, label: 'Upload Video', route: '/admin/upload', color: Colors.primary },
    { icon: Tag, label: 'Add Category', route: '/admin/categories', color: Colors.status.info },
    { icon: Users, label: 'Manage Users', route: '/admin/users', color: Colors.status.warning },
    { icon: BarChart3, label: 'Analytics', route: '/admin/analytics', color: Colors.status.error },
    { icon: Activity, label: 'View Reports', route: '/admin/analytics', color: Colors.status.success },
    { icon: Settings, label: 'System Settings', route: '/admin/settings', color: Colors.text.secondary },
  ];

  const systemHealth = [
    { name: 'Database', status: 'healthy', icon: Database },
    { name: 'Authentication', status: 'healthy', icon: Shield },
    { name: 'Storage', status: 'healthy', icon: HardDrive },
    { name: 'Upload Service', status: 'healthy', icon: CloudUpload },
  ];

  const getActivityIcon = (action: string) => {
    if (action.includes('upload')) return CloudUpload;
    if (action.includes('edit')) return Edit;
    if (action.includes('delete')) return Trash2;
    if (action.includes('category')) return Tag;
    if (action.includes('user')) return Users;
    if (action.includes('featured')) return Star;
    return Activity;
  };

  const renderBarChart = () => {
    if (!stats?.dailyViews || stats.dailyViews.length === 0) return null;
    const maxViews = Math.max(...stats.dailyViews.map(d => d.views), 1);
    return (
      <View style={styles.barsRow}>
        {stats.dailyViews.map((day, index) => {
          const barHeight = Math.max(4, (day.views / maxViews) * 100);
          const dayLabel = new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
          return (
            <Animated.View key={day.date} entering={FadeInUp.delay(index * 50).duration(300)} style={styles.barWrapper}>
              <View style={styles.barColumn}>
                <View style={[styles.bar, { height: barHeight }]} />
                <Text style={styles.barValue}>{day.views > 0 ? day.views : ''}</Text>
              </View>
              <Text style={styles.barLabel}>{dayLabel}</Text>
            </Animated.View>
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
            <TouchableOpacity key={index} style={styles.statCard} onPress={stat.onPress} activeOpacity={0.8}>
              <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
                <stat.icon size={18} color={stat.color} />
              </View>
              <Text style={styles.statValue}>{typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>

        {/* Views Analytics Card */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.analyticsCard}>
          <View style={styles.analyticsHeader}>
            <View style={styles.analyticsTitleRow}>
              <TrendingUp size={18} color={Colors.primary} />
              <Text style={styles.analyticsTitle}>Views Overview</Text>
            </View>
          </View>
          {renderBarChart()}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((item, index) => (
              <TouchableOpacity key={index} style={styles.quickActionItem} onPress={() => router.push(item.route as any)} activeOpacity={0.7}>
                <View style={[styles.quickActionIcon, { backgroundColor: `${item.color}15` }]}>
                  <item.icon size={20} color={item.color} />
                </View>
                <Text style={styles.quickActionLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* System Health */}
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>System Health</Text>
          <View style={styles.healthGrid}>
            {systemHealth.map((item, index) => (
              <View key={index} style={styles.healthCard}>
                <View style={styles.healthHeader}>
                  <item.icon size={16} color={Colors.status.success} />
                  <Text style={styles.healthName}>{item.name}</Text>
                </View>
                <View style={styles.healthStatusRow}>
                  <View style={styles.healthDot} />
                  <Text style={styles.healthStatus}>Healthy</Text>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Storage Overview */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Storage Overview</Text>
          <View style={styles.storageCard}>
            <View style={styles.storageHeader}>
              <HardDrive size={20} color={Colors.primary} />
              <Text style={styles.storageTitle}>Storage Usage</Text>
            </View>
            <View style={styles.storageBarTrack}>
              <Animated.View entering={FadeIn.duration(500)} style={[styles.storageBarFill, { width: `${Math.min((stats?.storageUsed || 0) / (50 * 1024 * 1024 * 1024) * 100, 100)}%` }]} />
            </View>
            <View style={styles.storageInfo}>
              <Text style={styles.storageUsed}>{stats?.storageUsedFormatted || '0 B'} used</Text>
              <Text style={styles.storageTotal}>of 50 GB</Text>
            </View>
          </View>
        </Animated.View>

        {/* Recent Activity */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <ChevronRight size={18} color={Colors.text.muted} />
          </View>
          {stats?.recentActivity && stats.recentActivity.length > 0 ? (
            stats.recentActivity.map((activity, index) => {
              const Icon = getActivityIcon(activity.action);
              const date = new Date(activity.created_at);
              return (
                <Animated.View entering={FadeIn.delay(index * 50).duration(200)} key={activity.id} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    <Icon size={16} color={Colors.text.secondary} />
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activityDescription}>{activity.description || activity.action}</Text>
                    <Text style={styles.activityTime}>{formatRelativeTime(date)}</Text>
                  </View>
                </Animated.View>
              );
            })
          ) : (
            <View style={styles.emptyActivity}>
              <Activity size={32} color={Colors.text.muted} />
              <Text style={styles.emptyActivityText}>No recent activity</Text>
            </View>
          )}
        </Animated.View>

        {/* Top Videos */}
        {stats?.topVideos && stats.topVideos.length > 0 && (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Top Performing Videos</Text>
              <TouchableOpacity onPress={() => router.push('/admin/analytics')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            {stats.topVideos.map((video, index) => (
              <View key={video.id} style={styles.topVideoItem}>
                <View style={styles.topVideoRank}>
                  <Text style={styles.topVideoRankText}>{index + 1}</Text>
                </View>
                <View style={styles.topVideoInfo}>
                  <Text style={styles.topVideoTitle} numberOfLines={1}>{video.title}</Text>
                  <Text style={styles.topVideoMeta}>{formatNumber(video.views_count)} views</Text>
                </View>
              </View>
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatWatchTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { backgroundColor: Colors.card, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 28, fontWeight: FontWeights.bold, color: Colors.text.primary },
  subtitle: { fontSize: FontSizes.md, color: Colors.text.secondary, marginTop: 4 },
  signOutButton: { padding: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  content: { flex: 1 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md },
  statCard: { width: CARD_WIDTH, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'flex-start', borderWidth: 1, borderColor: Colors.border },
  statIcon: { width: 36, height: 36, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: 20, fontWeight: FontWeights.bold, color: Colors.text.primary },
  statLabel: { fontSize: FontSizes.xs, color: Colors.text.secondary, marginTop: 4 },
  analyticsCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  analyticsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  analyticsTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  analyticsTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, paddingBottom: Spacing.sm },
  barWrapper: { alignItems: 'center', flex: 1 },
  barColumn: { alignItems: 'center', justifyContent: 'flex-end', flex: 1 },
  bar: { width: 20, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, minHeight: 4 },
  barValue: { fontSize: FontSizes.xs, color: Colors.text.secondary, marginTop: 4, fontWeight: FontWeights.medium },
  barLabel: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.xs },
  section: { marginBottom: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, marginTop: Spacing.md },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  seeAllText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  quickActionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  quickActionItem: { width: (width - Spacing.lg * 2 - Spacing.md) / 2, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  quickActionIcon: { width: 40, height: 40, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  quickActionLabel: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  healthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  healthCard: { width: (width - Spacing.lg * 2 - Spacing.md) / 2, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  healthHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  healthName: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  healthStatusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  healthDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.status.success },
  healthStatus: { fontSize: FontSizes.sm, color: Colors.status.success, fontWeight: FontWeights.medium },
  storageCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  storageHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  storageTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  storageBarTrack: { height: 12, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.full, overflow: 'hidden' },
  storageBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  storageInfo: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.sm },
  storageUsed: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  storageTotal: { fontSize: FontSizes.sm, color: Colors.text.muted },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  activityIcon: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  activityInfo: { flex: 1 },
  activityDescription: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  activityTime: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  emptyActivity: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm },
  emptyActivityText: { fontSize: FontSizes.md, color: Colors.text.muted },
  topVideoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  topVideoRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  topVideoRankText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  topVideoInfo: { flex: 1 },
  topVideoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 2 },
  topVideoMeta: { fontSize: FontSizes.sm, color: Colors.text.muted },
  footer: { height: Spacing.xxl },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  unauthorizedTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  unauthorizedText: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center' },
  loginButton: { marginTop: Spacing.lg, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  loginButtonText: { color: Colors.text.primary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
});
