import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, Clock, Film, Users, TrendingUp, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

interface AnalyticsData {
  totalViews: number;
  totalUsers: number;
  totalVideos: number;
  avgWatchTime: number;
  topVideos: { title: string; views: number }[];
  recentVideos: { title: string; created_at: string }[];
  viewsByDay: { date: string; count: number }[];
}

export default function AnalyticsScreen() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchAnalytics = useCallback(async () => {
    try {
      const [
        viewsRes,
        usersRes,
        videosRes,
        topVidsRes,
        recentVidsRes,
      ] = await Promise.all([
        supabase.from('video_views').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('*', { count: 'exact', head: true }),
        supabase.from('videos').select('title, views_count').order('views_count', { ascending: false }).limit(5),
        supabase.from('videos').select('title, created_at').order('created_at', { ascending: false }).limit(5),
      ]);

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: viewsData } = await supabase
        .from('video_views')
        .select('viewed_at, watch_duration')
        .gte('viewed_at', sevenDaysAgo.toISOString());

      const viewsByDay: { date: string; count: number }[] = [];
      const dayMap: Record<string, number> = {};
      let totalWatchDuration = 0;
      if (viewsData) {
        viewsData.forEach((v) => {
          const date = new Date(v.viewed_at).toLocaleDateString();
          dayMap[date] = (dayMap[date] || 0) + 1;
          totalWatchDuration += v.watch_duration || 0;
        });
        Object.entries(dayMap).forEach(([date, count]) => viewsByDay.push({ date, count }));
      }

      const avgWatchTime = viewsData && viewsData.length > 0 ? Math.floor(totalWatchDuration / viewsData.length) : 0;

      setData({
        totalViews: viewsRes.count || 0,
        totalUsers: usersRes.count || 0,
        totalVideos: videosRes.count || 0,
        avgWatchTime,
        topVideos: topVidsRes.data?.map((v) => ({ title: v.title, views: v.views_count })) || [],
        recentVideos: recentVidsRes.data?.map((v) => ({ title: v.title, created_at: v.created_at })) || [],
        viewsByDay: viewsByDay.slice(-7),
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    fetchAnalytics();
  }, [authLoading, user, isAdmin, router, fetchAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAnalytics();
    setRefreshing(false);
  }, [fetchAnalytics]);

  if (authLoading || loading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>Access Denied</Text>
        </View>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>No data available</Text>
        </View>
      </View>
    );
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const maxViews = Math.max(...data.viewsByDay.map((d) => d.count), 1);

  return (
    <ScrollView style={styles.container} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}>
      <View style={styles.header}>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.subtitle}>Platform overview</Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: 'rgba(229, 9, 20, 0.15)' }]}>
          <Eye size={24} color={Colors.primary} />
          <Text style={styles.statValue}>{formatNumber(data.totalViews)}</Text>
          <Text style={styles.statLabel}>Total Views</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
          <Users size={24} color={Colors.status.info} />
          <Text style={styles.statValue}>{formatNumber(data.totalUsers)}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(34, 197, 94, 0.15)' }]}>
          <Film size={24} color={Colors.status.success} />
          <Text style={styles.statValue}>{formatNumber(data.totalVideos)}</Text>
          <Text style={styles.statLabel}>Total Videos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: 'rgba(168, 85, 247, 0.15)' }]}>
          <Clock size={24} color={Colors.status.warning} />
          <Text style={styles.statValue}>{formatDuration(data.avgWatchTime)}</Text>
          <Text style={styles.statLabel}>Avg. Watch</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Most Watched Videos</Text>
        {data.topVideos.length > 0 ? data.topVideos.map((video, index) => (
          <View key={index} style={styles.topVideoItem}>
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{index + 1}</Text>
            </View>
            <View style={styles.topVideoInfo}>
              <Text style={styles.topVideoTitle} numberOfLines={2}>{video.title}</Text>
              <View style={styles.topVideoViews}>
                <Eye size={14} color={Colors.text.muted} />
                <Text style={styles.topVideoViewsText}>{formatNumber(video.views)} views</Text>
              </View>
            </View>
          </View>
        )) : <Text style={styles.noData}>No data available</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recently Uploaded</Text>
        {data.recentVideos.length > 0 ? data.recentVideos.map((video, index) => (
          <View key={index} style={styles.topVideoItem}>
            <View style={[styles.rankBadge, { backgroundColor: Colors.tertiary }]}>
              <Calendar size={16} color={Colors.text.secondary} />
            </View>
            <View style={styles.topVideoInfo}>
              <Text style={styles.topVideoTitle} numberOfLines={2}>{video.title}</Text>
              <Text style={styles.topVideoViewsText}>
                {new Date(video.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </View>
          </View>
        )) : <Text style={styles.noData}>No data available</Text>}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Views (Last 7 Days)</Text>
        <View style={styles.chartContainer}>
          <View style={styles.chartFake}>
            {data.viewsByDay.length > 0 ? (
              data.viewsByDay.map((day, i) => (
                <View key={i} style={styles.chartBar}>
                  <View style={[styles.chartBarFill, { height: `${Math.min(100, (day.count / maxViews) * 100)}%` }]} />
                  <Text style={styles.chartLabel}>{new Date(day.date).toLocaleDateString('en', { weekday: 'short' })}</Text>
                  <Text style={styles.chartValue}>{day.count}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noData}>No views data available</Text>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, marginBottom: Spacing.lg },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  subtitle: { fontSize: FontSizes.md, color: Colors.text.secondary, marginTop: Spacing.xs },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.md, marginBottom: Spacing.xl },
  statCard: { width: '48%', borderRadius: BorderRadius.lg, padding: Spacing.lg, alignItems: 'center' },
  statValue: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginTop: Spacing.sm },
  statLabel: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: Spacing.xs },
  section: { marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.md },
  topVideoItem: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.sm, alignItems: 'center' },
  rankBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
  rankText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  topVideoInfo: { flex: 1 },
  topVideoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  topVideoViews: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  topVideoViewsText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  chartContainer: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  chartFake: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', height: 140 },
  chartBar: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'flex-end' },
  chartBarFill: { width: 24, backgroundColor: Colors.primary, borderRadius: BorderRadius.sm, minHeight: 4 },
  chartLabel: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.xs },
  chartValue: { fontSize: FontSizes.xs, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
  noData: { fontSize: FontSizes.md, color: Colors.text.muted, textAlign: 'center', paddingVertical: Spacing.lg },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
});
