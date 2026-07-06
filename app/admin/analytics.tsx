import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  TrendingUp, Users, Eye, Clock, Film, Tag, BarChart3, Calendar,
  ChevronDown, Activity, Star, ArrowUp, ArrowDown,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');
const CHART_HEIGHT = 160;

type DateRange = 'today' | '7days' | '30days' | '90days' | 'year';

interface AnalyticsData {
  totalViews: number;
  totalUsers: number;
  totalVideos: number;
  avgWatchTime: number;
  viewsChange: number;
  usersChange: number;
  viewsOverTime: { label: string; value: number }[];
  userGrowth: { label: string; value: number }[];
  watchTimeOverTime: { label: string; value: number }[];
  topVideos: { video: Video; views: number }[];
  topCategories: { name: string; views: number; count: number }[];
  uploadActivity: { label: string; value: number }[];
  mostActiveUsers: { email: string; full_name: string; views: number; watch_time: number }[];
}

export default function AnalyticsScreen() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>('7days');
  const [showRangeMenu, setShowRangeMenu] = useState(false);

  const getDateRangeStart = (range: DateRange): Date => {
    const now = new Date();
    switch (range) {
      case 'today': return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      case '7days': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30days': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90days': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case 'year': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
  };

  const fetchAnalytics = useCallback(async () => {
    try {
      const startDate = getDateRangeStart(dateRange);
      const startISO = startDate.toISOString();

      const [viewsRes, usersRes, videosRes, watchRes, topVideosRes, recentSignups, allViews, allWatch] = await Promise.all([
        supabase.from('video_views').select('id', { count: 'exact', head: true }).gte('viewed_at', startISO),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('videos').select('id', { count: 'exact', head: true }).eq('status', 'published'),
        supabase.from('video_views').select('watch_duration').gte('viewed_at', startISO),
        supabase.from('videos').select('*').eq('status', 'published').order('views_count', { ascending: false }).limit(10),
        supabase.from('profiles').select('id, created_at').gte('created_at', startISO),
        supabase.from('video_views').select('viewed_at').gte('viewed_at', startISO),
        supabase.from('video_views').select('watch_duration, viewed_at').gte('viewed_at', startISO),
      ]);

      const totalViews = viewsRes.count || 0;
      const totalUsers = usersRes.count || 0;
      const totalVideos = videosRes.count || 0;
      let avgWatchTime = 0;
      if (watchRes.data && watchRes.data.length > 0) {
        const total = watchRes.data.reduce((sum: number, v: any) => sum + (v.watch_duration || 0), 0);
        avgWatchTime = Math.floor(total / watchRes.data.length);
      }

      // Views over time
      const interval = dateRange === 'today' ? 'hour' : dateRange === '7days' ? 'day' : dateRange === '30days' ? 'day' : 'week';
      const viewsOverTime = aggregateByInterval(allViews.data || [], 'viewed_at', interval, dateRange);

      // User growth
      const userGrowth = aggregateByInterval(recentSignups.data || [], 'created_at', interval, dateRange);

      // Watch time over time
      const watchTimeOverTime = aggregateByInterval(allWatch.data || [], 'viewed_at', interval, dateRange, 'watch_duration');

      // Top videos with view counts in range
      const topVideos: { video: Video; views: number }[] = [];
      if (topVideosRes.data) {
        for (const video of topVideosRes.data as Video[]) {
          const { count } = await supabase.from('video_views').select('id', { count: 'exact', head: true }).eq('video_id', video.id).gte('viewed_at', startISO);
          topVideos.push({ video, views: count || 0 });
        }
        topVideos.sort((a, b) => b.views - a.views);
      }

      // Top categories
      const { data: videoCats } = await supabase.from('video_categories').select('category_id, categories(name)').limit(200);
      const catMap = new Map<string, { name: string; views: number; count: number }>();
      if (videoCats) {
        for (const vc of videoCats as any[]) {
          const catId = vc.category_id;
          const catName = vc.categories?.name || 'Unknown';
          if (!catMap.has(catId)) catMap.set(catId, { name: catName, views: 0, count: 0 });
          const entry = catMap.get(catId)!;
          entry.count++;
        }
        // Get views per category
        for (const [catId, entry] of catMap) {
          const { data: junctionData } = await supabase.from('video_categories').select('video_id').eq('category_id', catId);
          if (junctionData) {
            const videoIds = junctionData.map(j => j.video_id);
            const { count } = await supabase.from('video_views').select('id', { count: 'exact', head: true }).in('video_id', videoIds).gte('viewed_at', startISO);
            entry.views = count || 0;
          }
        }
      }
      const topCategories = Array.from(catMap.values()).sort((a, b) => b.views - a.views).slice(0, 8);

      // Upload activity
      const { data: uploads } = await supabase.from('videos').select('created_at').gte('created_at', startISO);
      const uploadActivity = aggregateByInterval(uploads || [], 'created_at', interval, dateRange);

      // Most active users
      const { data: activeUsersData } = await supabase.from('video_views').select('user_id, watch_duration, profiles(email, full_name)').gte('viewed_at', startISO).not('user_id', 'is', null).limit(500);
      const userActivityMap = new Map<string, { email: string; full_name: string; views: number; watch_time: number }>();
      if (activeUsersData) {
        for (const view of activeUsersData as any[]) {
          if (!view.user_id) continue;
          if (!userActivityMap.has(view.user_id)) {
            userActivityMap.set(view.user_id, {
              email: view.profiles?.email || 'Unknown',
              full_name: view.profiles?.full_name || 'Unknown',
              views: 0, watch_time: 0,
            });
          }
          const entry = userActivityMap.get(view.user_id)!;
          entry.views++;
          entry.watch_time += view.watch_duration || 0;
        }
      }
      const mostActiveUsers = Array.from(userActivityMap.values()).sort((a, b) => b.views - a.views).slice(0, 10);

      // Calculate changes (compare to previous period)
      const prevStart = new Date(startDate.getTime() - (Date.now() - startDate.getTime()));
      const { count: prevViews } = await supabase.from('video_views').select('id', { count: 'exact', head: true }).gte('viewed_at', prevStart.toISOString()).lt('viewed_at', startISO);
      const viewsChange = prevViews ? ((totalViews - prevViews) / prevViews) * 100 : 0;
      const usersChange = recentSignups.count ? 100 : 0;

      setData({
        totalViews, totalUsers, totalVideos, avgWatchTime, viewsChange, usersChange,
        viewsOverTime, userGrowth, watchTimeOverTime, topVideos, topCategories,
        uploadActivity, mostActiveUsers,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { router.replace('/admin/login'); return; }
    setLoading(true);
    fetchAnalytics();
  }, [authLoading, user, isAdmin, router, fetchAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  }, [fetchAnalytics]);

  if (authLoading || loading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return <View style={styles.container}><View style={styles.unauthorized}><Text style={styles.unauthorizedText}>Access Denied</Text></View></View>;
  }

  const rangeLabels: Record<DateRange, string> = {
    today: 'Today', '7days': 'Last 7 Days', '30days': 'Last 30 Days', '90days': 'Last 90 Days', year: 'This Year',
  };

  const renderBarChart = (chartData: { label: string; value: number }[], color: string = Colors.primary) => {
    if (!chartData || chartData.length === 0) return <Text style={styles.noDataText}>No data available</Text>;
    const maxValue = Math.max(...chartData.map(d => d.value), 1);
    return (
      <View style={styles.barsRow}>
        {chartData.map((item, index) => {
          const barHeight = Math.max(4, (item.value / maxValue) * (CHART_HEIGHT - 40));
          return (
            <Animated.View key={index} entering={FadeInUp.delay(index * 30).duration(300)} style={styles.barWrapper}>
              <View style={styles.barColumn}>
                <Text style={styles.barValue}>{item.value > 0 ? formatNumber(item.value) : ''}</Text>
                <View style={[styles.bar, { height: barHeight, backgroundColor: color }]} />
              </View>
              <Text style={styles.barLabel}>{item.label}</Text>
            </Animated.View>
          );
        })}
      </View>
    );
  };

  const renderLineChart = (chartData: { label: string; value: number }[], color: string = Colors.status.info) => {
    if (!chartData || chartData.length === 0) return <Text style={styles.noDataText}>No data available</Text>;
    const maxValue = Math.max(...chartData.map(d => d.value), 1);
    const chartWidth = width - Spacing.lg * 2 - Spacing.lg * 2;
    const stepX = chartWidth / Math.max(chartData.length - 1, 1);

    return (
      <View style={styles.lineChartContainer}>
        <View style={[styles.lineChartArea, { height: CHART_HEIGHT }]}>
          {chartData.map((item, index) => {
            const left = index * stepX;
            const top = CHART_HEIGHT - 20 - (item.value / maxValue) * (CHART_HEIGHT - 40);
            return (
              <View key={index} style={[styles.linePoint, { left, top }]}>
                <View style={[styles.linePointDot, { backgroundColor: color }]} />
                {index === 0 && <Text style={styles.linePointValue}>{formatNumber(item.value)}</Text>}
              </View>
            );
          })}
          {/* Connecting line simulation using bars */}
          <View style={styles.lineChartBars}>
            {chartData.map((item, index) => {
              const barHeight = (item.value / maxValue) * (CHART_HEIGHT - 40);
              return <View key={index} style={[styles.lineBar, { height: Math.max(2, barHeight), backgroundColor: `${color}30'` }]} />;
            })}
          </View>
        </View>
        <View style={styles.lineChartLabels}>
          {chartData.map((item, index) => <Text key={index} style={styles.barLabel}>{item.label}</Text>)}
        </View>
      </View>
    );
  };

  const renderHorizontalBarChart = (items: { name: string; value: number }[], color: string, formatValue?: (v: number) => string) => {
    if (!items || items.length === 0) return <Text style={styles.noDataText}>No data available</Text>;
    const maxValue = Math.max(...items.map(i => i.value), 1);
    return (
      <View style={styles.hBarsContainer}>
        {items.map((item, index) => (
          <Animated.View entering={FadeIn.delay(index * 50).duration(200)} key={index} style={styles.hBarItem}>
            <Text style={styles.hBarLabel} numberOfLines={1}>{item.name}</Text>
            <View style={styles.hBarTrack}>
              <Animated.View entering={FadeIn.duration(500)} style={[styles.hBarFill, { width: `${(item.value / maxValue) * 100}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.hBarValue}>{formatValue ? formatValue(item.value) : formatNumber(item.value)}</Text>
          </Animated.View>
        ))}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Date Range Selector */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.rangeSelector} onPress={() => setShowRangeMenu(!showRangeMenu)}>
          <Calendar size={16} color={Colors.primary} />
          <Text style={styles.rangeText}>{rangeLabels[dateRange]}</Text>
          <ChevronDown size={16} color={Colors.text.muted} />
        </TouchableOpacity>
      </View>

      {showRangeMenu && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.rangeDropdown}>
          {(Object.keys(rangeLabels) as DateRange[]).map(range => (
            <TouchableOpacity key={range} style={[styles.rangeItem, dateRange === range && styles.rangeItemActive]} onPress={() => { setDateRange(range); setShowRangeMenu(false); }}>
              <Text style={[styles.rangeItemText, dateRange === range && styles.rangeItemTextActive]}>{rangeLabels[range]}</Text>
              {dateRange === range && <View style={styles.rangeCheck} />}
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
      >
        {/* KPI Cards */}
        <View style={styles.kpiGrid}>
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.kpiCard}>
            <View style={styles.kpiHeader}><View style={[styles.kpiIcon, { backgroundColor: `${Colors.primary}15` }]}><Eye size={18} color={Colors.primary} /></View><View style={[styles.kpiChange, (data?.viewsChange || 0) >= 0 ? styles.kpiChangePositive : styles.kpiChangeNegative]}><Text style={styles.kpiChangeText}>{(data?.viewsChange || 0) >= 0 ? '+' : ''}{(data?.viewsChange || 0).toFixed(1)}%</Text></View></View>
            <Text style={styles.kpiValue}>{formatNumber(data?.totalViews || 0)}</Text><Text style={styles.kpiLabel}>Total Views</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.kpiCard}>
            <View style={styles.kpiHeader}><View style={[styles.kpiIcon, { backgroundColor: `${Colors.status.info}15` }]}><Users size={18} color={Colors.status.info} /></View></View>
            <Text style={styles.kpiValue}>{formatNumber(data?.totalUsers || 0)}</Text><Text style={styles.kpiLabel}>Total Users</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.kpiCard}>
            <View style={styles.kpiHeader}><View style={[styles.kpiIcon, { backgroundColor: `${Colors.status.success}15` }]}><Film size={18} color={Colors.status.success} /></View></View>
            <Text style={styles.kpiValue}>{formatNumber(data?.totalVideos || 0)}</Text><Text style={styles.kpiLabel}>Published Videos</Text>
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.kpiCard}>
            <View style={styles.kpiHeader}><View style={[styles.kpiIcon, { backgroundColor: `${Colors.status.warning}15` }]}><Clock size={18} color={Colors.status.warning} /></View></View>
            <Text style={styles.kpiValue}>{formatWatchTime(data?.avgWatchTime || 0)}</Text><Text style={styles.kpiLabel}>Avg Watch Time</Text>
          </Animated.View>
        </View>

        {/* Views Over Time */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.chartCard}>
          <View style={styles.chartHeader}><TrendingUp size={18} color={Colors.primary} /><Text style={styles.chartTitle}>Views Over Time</Text></View>
          {renderBarChart(data?.viewsOverTime || [], Colors.primary)}
        </Animated.View>

        {/* User Growth */}
        <Animated.View entering={FadeInDown.delay(350).duration(400)} style={styles.chartCard}>
          <View style={styles.chartHeader}><Users size={18} color={Colors.status.info} /><Text style={styles.chartTitle}>User Growth</Text></View>
          {renderBarChart(data?.userGrowth || [], Colors.status.info)}
        </Animated.View>

        {/* Watch Time */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.chartCard}>
          <View style={styles.chartHeader}><Clock size={18} color={Colors.status.success} /><Text style={styles.chartTitle}>Watch Time</Text></View>
          {renderBarChart(data?.watchTimeOverTime || [], Colors.status.success)}
        </Animated.View>

        {/* Upload Activity */}
        <Animated.View entering={FadeInDown.delay(450).duration(400)} style={styles.chartCard}>
          <View style={styles.chartHeader}><Film size={18} color={Colors.status.warning} /><Text style={styles.chartTitle}>Upload Activity</Text></View>
          {renderBarChart(data?.uploadActivity || [], Colors.status.warning)}
        </Animated.View>

        {/* Top Videos */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)} style={styles.chartCard}>
          <View style={styles.chartHeader}><Star size={18} color={Colors.primary} /><Text style={styles.chartTitle}>Top Videos by Views</Text></View>
          {data?.topVideos && data.topVideos.length > 0 ? (
            data.topVideos.slice(0, 8).map((item, index) => (
              <Animated.View entering={FadeIn.delay(index * 50).duration(200)} key={item.video.id} style={styles.topItem}>
                <View style={styles.topRank}><Text style={styles.topRankText}>{index + 1}</Text></View>
                <View style={styles.topInfo}><Text style={styles.topTitle} numberOfLines={1}>{item.video.title}</Text><Text style={styles.topMeta}>{formatNumber(item.video.views_count)} total views</Text></View>
                <Text style={styles.topValue}>{formatNumber(item.views)}</Text>
              </Animated.View>
            ))
          ) : <Text style={styles.noDataText}>No video data available</Text>}
        </Animated.View>

        {/* Top Categories */}
        <Animated.View entering={FadeInDown.delay(550).duration(400)} style={styles.chartCard}>
          <View style={styles.chartHeader}><Tag size={18} color={Colors.status.info} /><Text style={styles.chartTitle}>Top Categories</Text></View>
          {data?.topCategories && data.topCategories.length > 0 ? (
            renderHorizontalBarChart(
              data.topCategories.map(c => ({ name: c.name, value: c.views })),
              Colors.status.info
            )
          ) : <Text style={styles.noDataText}>No category data available</Text>}
        </Animated.View>

        {/* Most Active Users */}
        <Animated.View entering={FadeInDown.delay(600).duration(400)} style={styles.chartCard}>
          <View style={styles.chartHeader}><Activity size={18} color={Colors.status.success} /><Text style={styles.chartTitle}>Most Active Users</Text></View>
          {data?.mostActiveUsers && data.mostActiveUsers.length > 0 ? (
            data.mostActiveUsers.map((u, index) => (
              <Animated.View entering={FadeIn.delay(index * 50).duration(200)} key={index} style={styles.userItem}>
                <View style={styles.userRank}><Text style={styles.userRankText}>{index + 1}</Text></View>
                <View style={styles.userInfo}><Text style={styles.userName} numberOfLines={1}>{u.full_name || u.email}</Text><Text style={styles.userMeta}>{formatNumber(u.views)} views · {formatWatchTime(u.watch_time)}</Text></View>
              </Animated.View>
            ))
          ) : <Text style={styles.noDataText}>No active users in this period</Text>}
        </Animated.View>

        <View style={styles.footer} />
      </ScrollView>
    </View>
  );
}

function aggregateByInterval(data: any[], dateField: string, interval: string, range: DateRange, valueField?: string): { label: string; value: number }[] {
  const result: { label: string; value: number }[] = [];
  const now = new Date();

  if (interval === 'hour') {
    for (let i = 23; i >= 0; i--) {
      const hour = new Date(now.getTime() - i * 60 * 60 * 1000);
      const label = hour.getHours().toString().padStart(2, '0') + ':00';
      const value = data.filter(d => {
        const dt = new Date(d[dateField]);
        return dt.getHours() === hour.getHours() && dt.toDateString() === hour.toDateString();
      }).reduce((sum, d) => sum + (valueField ? (d[valueField] || 0) : 1), 0);
      result.push({ label, value });
    }
  } else if (interval === 'day') {
    const days = range === '7days' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const label = day.toLocaleDateString('en-US', { weekday: 'short' }).charAt(0);
      const value = data.filter(d => new Date(d[dateField]).toDateString() === day.toDateString()).reduce((sum, d) => sum + (valueField ? (d[valueField] || 0) : 1), 0);
      result.push({ label, value });
    }
  } else if (interval === 'week') {
    for (let i = 12; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const label = `W${Math.ceil(weekStart.getDate() / 7)}`;
      const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
      const value = data.filter(d => { const dt = new Date(d[dateField]); return dt >= weekStart && dt < weekEnd; }).reduce((sum, d) => sum + (valueField ? (d[valueField] || 0) : 1), 0);
      result.push({ label, value });
    }
  }
  return result;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatWatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  rangeSelector: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, alignSelf: 'flex-start', borderWidth: 1, borderColor: Colors.border },
  rangeText: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  rangeDropdown: { marginHorizontal: Spacing.lg, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  rangeItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm },
  rangeItemActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  rangeItemText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  rangeItemTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  rangeCheck: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary },
  content: { flex: 1 },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  kpiCard: { width: (width - Spacing.lg * 2 - Spacing.md) / 2, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  kpiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  kpiIcon: { width: 36, height: 36, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  kpiChange: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  kpiChangePositive: { backgroundColor: 'rgba(34, 197, 94, 0.15)' },
  kpiChangeNegative: { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
  kpiChangeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.secondary },
  kpiValue: { fontSize: 24, fontWeight: FontWeights.bold, color: Colors.text.primary },
  kpiLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  chartCard: { marginHorizontal: Spacing.lg, marginTop: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg, borderWidth: 1, borderColor: Colors.border },
  chartHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  chartTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  barsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: CHART_HEIGHT },
  barWrapper: { alignItems: 'center', flex: 1 },
  barColumn: { alignItems: 'center', justifyContent: 'flex-end', flex: 1, width: '100%' },
  bar: { width: 16, borderRadius: BorderRadius.sm, minHeight: 4 },
  barValue: { fontSize: FontSizes.xs, color: Colors.text.secondary, marginBottom: 4, fontWeight: FontWeights.medium },
  barLabel: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.xs },
  lineChartContainer: { backgroundColor: Colors.tertiary, borderRadius: BorderRadius.md, padding: Spacing.md },
  lineChartArea: { position: 'relative', flexDirection: 'row' },
  linePoint: { position: 'absolute' },
  linePointDot: { width: 8, height: 8, borderRadius: 4 },
  linePointValue: { position: 'absolute', top: -16, fontSize: FontSizes.xs, color: Colors.text.secondary },
  lineChartBars: { flexDirection: 'row', flex: 1, alignItems: 'flex-end', gap: 2 },
  lineBar: { flex: 1, borderRadius: BorderRadius.sm },
  lineChartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.xs },
  hBarsContainer: { gap: Spacing.sm },
  hBarItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hBarLabel: { width: 80, fontSize: FontSizes.sm, color: Colors.text.secondary },
  hBarTrack: { flex: 1, height: 12, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.full, overflow: 'hidden' },
  hBarFill: { height: '100%', borderRadius: BorderRadius.full },
  hBarValue: { width: 50, fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium, textAlign: 'right' },
  topItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md },
  topRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  topRankText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.primary },
  topInfo: { flex: 1 },
  topTitle: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  topMeta: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  topValue: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: FontWeights.bold },
  userItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.md },
  userRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  userRankText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.secondary },
  userInfo: { flex: 1 },
  userName: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  userMeta: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  noDataText: { fontSize: FontSizes.md, color: Colors.text.muted, textAlign: 'center', paddingVertical: Spacing.lg },
  footer: { height: Spacing.xxl },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
});
