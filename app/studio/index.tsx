import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowLeft,
  Film,
  Play,
  Eye,
  ThumbsUp,
  MessageSquare,
  Users,
  Clock,
  Upload,
  Grid3x3,
  HardDrive,
  TrendingUp,
  Plus,
  Zap,
  Radio,
  DollarSign,
  BarChart3,
  Share2,
  Calendar,
  Award,
  ChevronRight,
  Bell,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import {
  getCreatorStats,
  getCreatorActivity,
  formatBytes,
  formatDuration,
  type CreatorDashboardStats,
  type CreatorActivity,
} from '@/lib/creators';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

const STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;

export default function StudioDashboard() {
  useAuthGuard(true);
  const router = useRouter();
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<CreatorDashboardStats | null>(null);
  const [activity, setActivity] = useState<CreatorActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const [s, a] = await Promise.all([
        getCreatorStats(user.id),
        getCreatorActivity(user.id, 8),
      ]);
      setStats(s);
      setActivity(a);
    } catch (error) {
      console.error('Error fetching studio data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getActivityIcon = (type: CreatorActivity['type']) => {
    switch (type) {
      case 'upload': return <Film size={16} color={Colors.primary} />;
      case 'short': return <Play size={16} color="#3B82F6" />;
      case 'subscriber': return <Users size={16} color="#EC4899" />;
      case 'comment': return <MessageSquare size={16} color="#8B5CF6" />;
      case 'like': return <ThumbsUp size={16} color="#F59E0B" />;
    }
  };

  const estimatedRevenue = ((stats?.totalViews ?? 0) * 0.002).toFixed(2);
  const estimatedShares = Math.round((stats?.totalLikes ?? 0) * 0.05);
  const monthlyGrowth = stats && stats.subscribers > 0 ? `+${Math.round(stats.subscribers * 0.08)}` : '+0';

  const statCards = [
    { icon: Users, label: 'Subscribers', value: formatCount(stats?.subscribers ?? 0), color: '#EC4899', growth: monthlyGrowth },
    { icon: Film, label: 'Videos', value: formatCount(stats?.totalVideos ?? 0), color: Colors.primary },
    { icon: Play, label: 'Shorts', value: formatCount(stats?.totalShorts ?? 0), color: '#3B82F6' },
    { icon: Eye, label: 'Total Views', value: formatCount(stats?.totalViews ?? 0), color: '#10B981' },
    { icon: Clock, label: 'Watch Time', value: formatDuration(stats?.watchTime ?? 0), color: '#06B6D4' },
    { icon: ThumbsUp, label: 'Likes', value: formatCount(stats?.totalLikes ?? 0), color: '#F59E0B' },
    { icon: MessageSquare, label: 'Comments', value: formatCount(stats?.totalComments ?? 0), color: '#8B5CF6' },
    { icon: Share2, label: 'Shares', value: formatCount(estimatedShares), color: '#F97316' },
    { icon: DollarSign, label: 'Est. Revenue', value: `$${estimatedRevenue}`, color: '#22C55E' },
    { icon: TrendingUp, label: 'Monthly Growth', value: monthlyGrowth, color: '#A855F7' },
  ];

  const quickActions = [
    { icon: Upload, label: 'Upload Video', route: '/studio/upload', color: Colors.primary },
    { icon: Play, label: 'Upload Short', route: '/studio/upload-short', color: '#3B82F6' },
    { icon: Radio, label: 'Go Live', route: '/studio/go-live', color: '#EF4444' },
    { icon: DollarSign, label: 'Monetization', route: '/studio/monetization', color: '#10B981' },
    { icon: Grid3x3, label: 'My Content', route: '/studio/content', color: '#10B981' },
    { icon: BarChart3, label: 'Analytics', route: '/studio/analytics', color: '#F59E0B' },
    { icon: HardDrive, label: 'Storage', route: '/studio/storage', color: '#F59E0B' },
    { icon: Award, label: 'Achievements', route: '/studio/achievements', color: '#A855F7' },
  ];

  const studioNav = [
    { icon: Grid3x3, label: 'Content Manager', route: '/studio/content', desc: 'Manage all your videos' },
    { icon: Clock, label: 'Scheduled', route: '/studio/scheduled', desc: 'View scheduled uploads' },
    { icon: MessageSquare, label: 'Comments', route: '/studio/comments', desc: 'Moderate comments' },
    { icon: BarChart3, label: 'Analytics', route: '/studio/analytics', desc: 'Deep dive into your data' },
    { icon: Play, label: 'Playlists', route: '/studio/playlists', desc: 'Create and manage playlists' },
    { icon: Users, label: 'Customization', route: '/studio/customization', desc: 'Channel branding' },
    { icon: Award, label: 'Copyright', route: '/studio/copyright', desc: 'Copyright & reports' },
    { icon: Bell, label: 'Notifications', route: '/studio/notifications', desc: 'Creator notifications' },
  ];

  const chartData = [40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88];
  const chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const maxChartValue = Math.max(...chartData);

  const weekData = [35, 50, 42, 68, 55, 78, 62];
  const weekLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>Creator Studio</Text>
              <Text style={styles.headerSubtitle}>{profile?.full_name || profile?.email || 'Creator'}</Text>
            </View>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/studio/settings')}>
              <TrendingUp size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Quick Actions */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.quickActionsRow}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.quickAction}
                onPress={() => router.push(action.route as any)}
                activeOpacity={0.7}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: action.color + '20' }]}>
                  <action.icon size={22} color={action.color} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>

          {/* Stats Grid */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Channel Overview</Text>
              <TouchableOpacity onPress={() => router.push('/studio/analytics')}>
                <Text style={styles.viewAll}>View Analytics</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statsGrid}>
              {statCards.map((stat, i) => (
                <Animated.View
                  key={stat.label}
                  entering={FadeInUp.delay(i * 40).duration(300)}
                  style={styles.statCard}
                >
                  <View style={[styles.statIcon, { backgroundColor: stat.color + '20' }]}>
                    <stat.icon size={18} color={stat.color} />
                  </View>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                  {stat.growth && (
                    <View style={styles.growthBadge}>
                      <TrendingUp size={10} color={Colors.status.success} />
                      <Text style={styles.growthText}>{stat.growth}</Text>
                    </View>
                  )}
                </Animated.View>
              ))}
            </View>
          </Animated.View>

          {/* Yearly Views Chart */}
          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Views Overview (12 months)</Text>
            </View>
            <View style={styles.chartContainer}>
              <View style={styles.chartBars}>
                {chartData.map((h, i) => (
                  <View key={i} style={styles.chartBarWrap}>
                    <View style={[styles.chartBar, { height: `${(h / maxChartValue) * 100}%` }]}>
                      <View style={styles.chartBarTop} />
                    </View>
                    <Text style={styles.chartDayLabel}>{chartLabels[i]}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Weekly Views Chart */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>This Week</Text>
            </View>
            <View style={styles.chartContainer}>
              <View style={styles.chartBars}>
                {weekData.map((h, i) => (
                  <View key={i} style={styles.chartBarWrap}>
                    <View style={[styles.chartBar, { height: `${(h / Math.max(...weekData)) * 100}%` }]} />
                    <Text style={styles.chartDayLabel}>{weekLabels[i]}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Studio Navigation */}
          <Animated.View entering={FadeInDown.delay(250).duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Studio Tools</Text>
            </View>
            <View style={styles.navGrid}>
              {studioNav.map((item, i) => (
                <TouchableOpacity
                  key={item.label}
                  style={styles.navCard}
                  onPress={() => router.push(item.route as any)}
                  activeOpacity={0.7}
                >
                  <View style={styles.navIconWrap}>
                    <item.icon size={20} color={Colors.text.secondary} />
                  </View>
                  <View style={styles.navInfo}>
                    <Text style={styles.navLabel}>{item.label}</Text>
                    <Text style={styles.navDesc}>{item.desc}</Text>
                  </View>
                  <ChevronRight size={18} color={Colors.text.muted} />
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>

          {/* Recent Activity */}
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
            </View>
            {activity.length === 0 ? (
              <View style={styles.emptyActivity}>
                <Film size={32} color={Colors.text.muted} />
                <Text style={styles.emptyText}>No recent activity</Text>
                <Text style={styles.emptySubtext}>Upload your first video to get started</Text>
              </View>
            ) : (
              <View style={styles.activityList}>
                {activity.map((item, i) => (
                  <Animated.View
                    key={item.id}
                    entering={FadeInUp.delay(i * 30).duration(200)}
                    style={styles.activityItem}
                  >
                    <View style={styles.activityIconContainer}>
                      {getActivityIcon(item.type)}
                    </View>
                    <Text style={styles.activityMessage} numberOfLines={2}>{item.message}</Text>
                    <Text style={styles.activityTime}>{formatTimeAgo(item.created_at)}</Text>
                  </Animated.View>
                ))}
              </View>
            )}
          </Animated.View>

          {/* Top Performing Videos */}
          {stats && stats.topVideos && stats.topVideos.length > 0 && (
            <Animated.View entering={FadeInDown.delay(350).duration(300)}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Performing Videos</Text>
              </View>
              <View style={styles.topVideosList}>
                {stats.topVideos.slice(0, 5).map((v, i) => (
                  <TouchableOpacity
                    key={v.id}
                    style={styles.topVideoItem}
                    onPress={() => router.push(`/video/${v.id}`)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.topVideoRank}>
                      <Text style={styles.topVideoRankText}>#{i + 1}</Text>
                    </View>
                    <View style={styles.topVideoInfo}>
                      <Text style={styles.topVideoTitle} numberOfLines={1}>{v.title}</Text>
                      <View style={styles.topVideoMeta}>
                        <View style={styles.topVideoMetaItem}>
                          <Eye size={12} color={Colors.text.muted} />
                          <Text style={styles.topVideoMetaText}>{formatCount(v.views_count)}</Text>
                        </View>
                        <View style={styles.topVideoMetaItem}>
                          <ThumbsUp size={12} color={Colors.text.muted} />
                          <Text style={styles.topVideoMetaText}>{formatCount(v.like_count || 0)}</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Upload CTA */}
          <Animated.View entering={FadeInDown.delay(400).duration(300)} style={styles.uploadCTA}>
            <View style={styles.ctaIcon}>
              <Plus size={28} color={Colors.primary} />
            </View>
            <View style={styles.ctaContent}>
              <Text style={styles.ctaTitle}>Ready to upload?</Text>
              <Text style={styles.ctaSubtitle}>Share your content with the world</Text>
            </View>
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={() => router.push('/studio/upload')}
              activeOpacity={0.7}
            >
              <Upload size={16} color={Colors.text.primary} />
              <Text style={styles.ctaButtonText}>Upload</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.muted },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl },
  backButton: { padding: Spacing.xs },
  headerInfo: { marginLeft: Spacing.sm, flex: 1 },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  headerSubtitle: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  settingsBtn: { padding: Spacing.sm },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  quickAction: { width: (width - Spacing.lg * 2 - Spacing.sm * 3) / 4, alignItems: 'center', gap: Spacing.xs },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: { fontSize: 10, color: Colors.text.secondary, textAlign: 'center', fontWeight: FontWeights.medium },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  viewAll: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: {
    width: (width - Spacing.lg * 2 - Spacing.sm * 2) / 3,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  statLabel: { fontSize: 10, color: Colors.text.muted, textAlign: 'center' },
  growthBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  growthText: { fontSize: 9, color: Colors.status.success, fontWeight: FontWeights.semibold },
  chartContainer: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 4 },
  chartBarWrap: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '80%', backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, minHeight: 4 },
  chartBarTop: { width: '100%', height: 3, backgroundColor: '#FF6B6B', borderTopLeftRadius: BorderRadius.sm, borderTopRightRadius: BorderRadius.sm },
  chartDayLabel: { fontSize: 8, color: Colors.text.muted },
  navGrid: { gap: Spacing.xs, marginBottom: Spacing.xl },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  navIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  navInfo: { flex: 1 },
  navLabel: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  navDesc: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  activityList: { gap: Spacing.xs, marginBottom: Spacing.xl },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityIconContainer: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  activityMessage: { flex: 1, fontSize: FontSizes.sm, color: Colors.text.secondary },
  activityTime: { fontSize: FontSizes.xs, color: Colors.text.muted },
  emptyActivity: { alignItems: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.md, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  emptySubtext: { fontSize: FontSizes.sm, color: Colors.text.muted },
  topVideosList: { gap: Spacing.sm, marginBottom: Spacing.lg },
  topVideoItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  topVideoRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(229, 9, 20, 0.1)', justifyContent: 'center', alignItems: 'center' },
  topVideoRankText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.primary },
  topVideoInfo: { flex: 1 },
  topVideoTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4 },
  topVideoMeta: { flexDirection: 'row', gap: Spacing.md },
  topVideoMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topVideoMetaText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  uploadCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  ctaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(229, 9, 20, 0.1)', justifyContent: 'center', alignItems: 'center' },
  ctaContent: { flex: 1 },
  ctaTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary },
  ctaSubtitle: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  ctaButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  ctaButtonText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
});
