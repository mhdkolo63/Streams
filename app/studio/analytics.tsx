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
  Eye,
  ThumbsUp,
  MessageSquare,
  Users,
  Clock,
  TrendingUp,
  Globe,
  Search,
  Share2,
  UserPlus,
  BarChart3,
  Activity,
  Video,
  Play,
  Heart,
  Repeat2,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { getCreatorStats, type CreatorDashboardStats } from '@/lib/creators';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

type TimeRange = 'daily' | 'weekly' | 'monthly';
type ChartTab = 'views' | 'watchTime' | 'subscribers' | 'engagement';

export default function StudioAnalyticsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<CreatorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('weekly');
  const [chartTab, setChartTab] = useState<ChartTab>('views');

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const s = await getCreatorStats(user.id);
      setStats(s);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    if (mins > 0) return `${mins}m`;
    return `${seconds}s`;
  };

  const chartDataMap: Record<TimeRange, number[]> = {
    daily: [35, 50, 42, 68, 55, 78, 62],
    weekly: [120, 145, 110, 180, 155, 200, 175, 190, 165, 210],
    monthly: [800, 950, 720, 1100, 890, 1250, 1000, 1180, 950, 1400, 1100, 1600],
  };

  const chartData = chartDataMap[timeRange];
  const maxVal = Math.max(...chartData);
  const chartLabels: Record<TimeRange, string[]> = {
    daily: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    weekly: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10'],
    monthly: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  };

  const chartTabConfig: Record<ChartTab, { label: string; icon: typeof Eye }> = {
    views: { label: 'Views', icon: Eye },
    watchTime: { label: 'Watch Time', icon: Clock },
    subscribers: { label: 'Subscribers', icon: Users },
    engagement: { label: 'Engagement', icon: Heart },
  };

  const overviewStats = [
    { icon: Eye, label: 'Views', value: formatCount(stats?.totalViews ?? 0), change: '+12.3%', up: true, color: '#10B981' },
    { icon: Clock, label: 'Watch Time', value: formatDuration(stats?.watchTime ?? 0), change: '+8.1%', up: true, color: '#06B6D4' },
    { icon: Users, label: 'Subscribers', value: formatCount(stats?.subscribers ?? 0), change: '+5.4%', up: true, color: '#EC4899' },
    { icon: ThumbsUp, label: 'Likes', value: formatCount(stats?.totalLikes ?? 0), change: '+15.2%', up: true, color: '#F59E0B' },
    { icon: MessageSquare, label: 'Comments', value: formatCount(stats?.totalComments ?? 0), change: '-2.1%', up: false, color: '#8B5CF6' },
    { icon: Share2, label: 'Shares', value: formatCount(Math.round((stats?.totalLikes ?? 0) * 0.05)), change: '+7.8%', up: true, color: '#F97316' },
  ];

  const trafficSources = [
    { label: 'Browse Features', value: 35, color: Colors.primary },
    { label: 'Suggested Videos', value: 28, color: '#3B82F6' },
    { label: 'Search', value: 18, color: '#10B981' },
    { label: 'External', value: 10, color: '#F59E0B' },
    { label: 'Direct', value: 9, color: '#8B5CF6' },
  ];

  const audienceRetention = [
    { time: '0:00', retention: 100 },
    { time: '0:15', retention: 85 },
    { time: '0:30', retention: 72 },
    { time: '1:00', retention: 65 },
    { time: '2:00', retention: 58 },
    { time: '3:00', retention: 50 },
    { time: '5:00', retention: 42 },
    { time: 'End', retention: 38 },
  ];

  const topVideos = stats?.topVideos || [];
  const topShorts = stats?.topShorts || [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Analytics</Text>
          </View>

          {/* Time Range */}
          <View style={styles.timeRangeRow}>
            {(['daily', 'weekly', 'monthly'] as TimeRange[]).map((range) => (
              <TouchableOpacity
                key={range}
                style={[styles.timeRangeBtn, timeRange === range && styles.timeRangeBtnActive]}
                onPress={() => setTimeRange(range)}
              >
                <Text style={[styles.timeRangeText, timeRange === range && styles.timeRangeTextActive]}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Overview Stats */}
          <View style={styles.overviewGrid}>
            {overviewStats.map((stat, i) => (
              <Animated.View key={stat.label} entering={FadeInDown.delay(i * 50).duration(300)} style={styles.overviewCard}>
                <View style={styles.overviewHeader}>
                  <View style={[styles.overviewIcon, { backgroundColor: stat.color + '20' }]}>
                    <stat.icon size={16} color={stat.color} />
                  </View>
                  <View style={[styles.changeBadge, stat.up ? styles.changeUp : styles.changeDown]}>
                    {stat.up ? <ArrowUpRight size={10} color={Colors.status.success} /> : <ArrowDownRight size={10} color={Colors.status.error} />}
                    <Text style={[styles.changeText, stat.up ? styles.changeTextUp : styles.changeTextDown]}>{stat.change}</Text>
                  </View>
                </View>
                <Text style={styles.overviewValue}>{stat.value}</Text>
                <Text style={styles.overviewLabel}>{stat.label}</Text>
              </Animated.View>
            ))}
          </View>

          {/* Main Chart */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.chartSection}>
            <View style={styles.chartTabRow}>
              {(Object.keys(chartTabConfig) as ChartTab[]).map((tab) => (
                <TouchableOpacity
                  key={tab}
                  style={[styles.chartTab, chartTab === tab && styles.chartTabActive]}
                  onPress={() => setChartTab(tab)}
                >
                  {(() => {
                    const TabIcon = chartTabConfig[tab].icon;
                    return <TabIcon size={14} color={chartTab === tab ? Colors.primary : Colors.text.muted} />;
                  })()}
                  <Text style={[styles.chartTabText, chartTab === tab && styles.chartTabTextActive]}>
                    {chartTabConfig[tab].label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.chartCard}>
              <View style={styles.chartBars}>
                {chartData.map((h, i) => (
                  <View key={i} style={styles.chartBarWrap}>
                    <View style={[styles.chartBar, { height: `${(h / maxVal) * 100}%` }]} />
                    <Text style={styles.chartLabel}>{chartLabels[timeRange][i]}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* Audience Retention */}
          <Animated.View entering={FadeInDown.delay(250).duration(300)}>
            <Text style={styles.sectionTitle}>Audience Retention</Text>
            <View style={styles.retentionCard}>
              {audienceRetention.map((point, i) => (
                <View key={i} style={styles.retentionRow}>
                  <Text style={styles.retentionTime}>{point.time}</Text>
                  <View style={styles.retentionBar}>
                    <View style={[styles.retentionFill, { width: `${point.retention}%` }]} />
                  </View>
                  <Text style={styles.retentionPercent}>{point.retention}%</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Traffic Sources */}
          <Animated.View entering={FadeInDown.delay(300).duration(300)}>
            <Text style={styles.sectionTitle}>Traffic Sources</Text>
            <View style={styles.trafficCard}>
              {trafficSources.map((source) => (
                <View key={source.label} style={styles.trafficRow}>
                  <View style={styles.trafficLabelRow}>
                    <View style={[styles.trafficDot, { backgroundColor: source.color }]} />
                    <Text style={styles.trafficLabel}>{source.label}</Text>
                  </View>
                  <View style={styles.trafficBar}>
                    <View style={[styles.trafficFill, { width: `${source.value}%`, backgroundColor: source.color }]} />
                  </View>
                  <Text style={styles.trafficPercent}>{source.value}%</Text>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Top Videos */}
          {topVideos.length > 0 && (
            <Animated.View entering={FadeInDown.delay(350).duration(300)}>
              <Text style={styles.sectionTitle}>Top Videos</Text>
              <View style={styles.topListCard}>
                {topVideos.slice(0, 5).map((v, i) => (
                  <TouchableOpacity key={v.id} style={styles.topItem} onPress={() => router.push(`/video/${v.id}`)}>
                    <Text style={styles.topRank}>#{i + 1}</Text>
                    <View style={styles.topInfo}>
                      <Text style={styles.topTitle} numberOfLines={1}>{v.title}</Text>
                      <View style={styles.topMeta}>
                        <Eye size={11} color={Colors.text.muted} />
                        <Text style={styles.topMetaText}>{formatCount(v.views_count)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Top Shorts */}
          {topShorts.length > 0 && (
            <Animated.View entering={FadeInDown.delay(400).duration(300)}>
              <Text style={styles.sectionTitle}>Top Shorts</Text>
              <View style={styles.topListCard}>
                {topShorts.slice(0, 5).map((v, i) => (
                  <TouchableOpacity key={v.id} style={styles.topItem} onPress={() => router.push(`/video/${v.id}`)}>
                    <Text style={styles.topRank}>#{i + 1}</Text>
                    <View style={styles.topInfo}>
                      <Text style={styles.topTitle} numberOfLines={1}>{v.title}</Text>
                      <View style={styles.topMeta}>
                        <Eye size={11} color={Colors.text.muted} />
                        <Text style={styles.topMetaText}>{formatCount(v.views_count)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>
          )}

          {/* New vs Returning */}
          <Animated.View entering={FadeInDown.delay(450).duration(300)}>
            <Text style={styles.sectionTitle}>Audience</Text>
            <View style={styles.audienceRow}>
              <View style={styles.audienceCard}>
                <UserPlus size={24} color="#3B82F6" />
                <Text style={styles.audienceValue}>{formatCount(Math.round((stats?.totalViews ?? 0) * 0.35))}</Text>
                <Text style={styles.audienceLabel}>New Viewers</Text>
              </View>
              <View style={styles.audienceCard}>
                <Repeat2 size={24} color="#10B981" />
                <Text style={styles.audienceValue}>{formatCount(Math.round((stats?.totalViews ?? 0) * 0.65))}</Text>
                <Text style={styles.audienceLabel}>Returning</Text>
              </View>
            </View>
          </Animated.View>

          {/* Engagement Rate */}
          <Animated.View entering={FadeInDown.delay(500).duration(300)} style={styles.engagementCard}>
            <View style={styles.engagementHeader}>
              <Activity size={20} color={Colors.primary} />
              <Text style={styles.engagementTitle}>Engagement Rate</Text>
            </View>
            <Text style={styles.engagementValue}>{stats?.engagementRate ?? 0}%</Text>
            <Text style={styles.engagementDesc}>
              Based on likes and comments relative to total views
            </Text>
          </Animated.View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  timeRangeRow: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: 3, marginBottom: Spacing.lg, gap: 2 },
  timeRangeBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, alignItems: 'center' },
  timeRangeBtnActive: { backgroundColor: Colors.tertiary },
  timeRangeText: { fontSize: FontSizes.sm, color: Colors.text.muted, fontWeight: FontWeights.medium },
  timeRangeTextActive: { color: Colors.text.primary, fontWeight: FontWeights.semibold },
  overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  overviewCard: { width: (width - Spacing.lg * 2 - Spacing.sm * 2) / 3, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  overviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  overviewIcon: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  changeBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  changeUp: {},
  changeDown: {},
  changeText: { fontSize: 9, fontWeight: FontWeights.semibold },
  changeTextUp: { color: Colors.status.success },
  changeTextDown: { color: Colors.status.error },
  overviewValue: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: 2 },
  overviewLabel: { fontSize: 10, color: Colors.text.muted },
  chartSection: { marginBottom: Spacing.lg },
  chartTabRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.sm },
  chartTab: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chartTabActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)', borderColor: Colors.primary },
  chartTabText: { fontSize: FontSizes.xs, color: Colors.text.muted, fontWeight: FontWeights.medium },
  chartTabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  chartCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  chartBars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150, gap: 4 },
  chartBarWrap: { flex: 1, alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' },
  chartBar: { width: '80%', backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, minHeight: 4 },
  chartLabel: { fontSize: 8, color: Colors.text.muted },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  retentionCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs },
  retentionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  retentionTime: { width: 45, fontSize: FontSizes.xs, color: Colors.text.muted, fontWeight: FontWeights.medium },
  retentionBar: { flex: 1, height: 8, backgroundColor: Colors.tertiary, borderRadius: 4, overflow: 'hidden' },
  retentionFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 4 },
  retentionPercent: { width: 36, fontSize: FontSizes.xs, color: Colors.text.secondary, fontWeight: FontWeights.semibold, textAlign: 'right' },
  trafficCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, gap: Spacing.md },
  trafficRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  trafficLabelRow: { width: 110, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  trafficDot: { width: 8, height: 8, borderRadius: 4 },
  trafficLabel: { fontSize: FontSizes.xs, color: Colors.text.secondary },
  trafficBar: { flex: 1, height: 8, backgroundColor: Colors.tertiary, borderRadius: 4, overflow: 'hidden' },
  trafficFill: { height: '100%', borderRadius: 4 },
  trafficPercent: { width: 36, fontSize: FontSizes.xs, color: Colors.text.secondary, fontWeight: FontWeights.semibold, textAlign: 'right' },
  topListCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.sm, marginBottom: Spacing.lg },
  topItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xs },
  topRank: { width: 28, fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.primary },
  topInfo: { flex: 1 },
  topTitle: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium, marginBottom: 2 },
  topMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  topMetaText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  audienceRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  audienceCard: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center', gap: Spacing.xs, borderWidth: 1, borderColor: Colors.border },
  audienceValue: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  audienceLabel: { fontSize: FontSizes.xs, color: Colors.text.muted },
  engagementCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border, marginBottom: Spacing.lg },
  engagementHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  engagementTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  engagementValue: { fontSize: FontSizes.xxxl, fontWeight: FontWeights.bold, color: Colors.primary, marginBottom: Spacing.xs },
  engagementDesc: { fontSize: FontSizes.sm, color: Colors.text.muted },
});
