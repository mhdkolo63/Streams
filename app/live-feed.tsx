import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, FlatList, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Radio, Users, Calendar, Crown, Lock, Eye,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import {
  getLiveStreams,
  formatViewerCount,
  type LiveStreamWithCreator,
} from '../lib/live';
import { CachedImage } from '../components/CachedImage';

export default function LiveFeedPage() {
  const router = useRouter();
  const [streams, setStreams] = useState<LiveStreamWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'live' | 'scheduled' | 'all'>('live');

  const loadStreams = useCallback(async () => {
    try {
      const data = await getLiveStreams(filter === 'all' ? 'all' : filter, 50);
      setStreams(data);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadStreams();
  }, [loadStreams]);

  const onRefresh = () => {
    setRefreshing(true);
    loadStreams();
  };

  const liveStreams = streams.filter((s) => s.status === 'live');
  const scheduledStreams = streams.filter((s) => s.status === 'scheduled');

  const renderStream = ({ item, index }: { item: LiveStreamWithCreator; index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(200)}>
      <TouchableOpacity
        style={styles.streamCard}
        onPress={() => router.push(`/live/${item.id}`)}
        activeOpacity={0.8}
      >
        <View style={styles.thumbnailContainer}>
          <CachedImage uri={item.thumbnail_url || ''} style={styles.thumbnail} />
          <View style={styles.thumbnailOverlay} />
          {item.status === 'live' && (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          )}
          {item.status === 'scheduled' && (
            <View style={styles.scheduledBadge}>
              <Calendar size={12} color="#fff" />
              <Text style={styles.scheduledText}>SCHEDULED</Text>
            </View>
          )}
          {item.is_premium && (
            <View style={styles.premiumBadge}>
              <Crown size={12} color="#FFD700" />
            </View>
          )}
          {item.is_member_only && (
            <View style={styles.memberBadge}>
              <Lock size={12} color={Colors.status.info} />
            </View>
          )}
          {item.status === 'live' && (
            <View style={styles.viewerBadge}>
              <Eye size={12} color="#fff" />
              <Text style={styles.viewerText}>{formatViewerCount(item.viewer_count)}</Text>
            </View>
          )}
        </View>
        <View style={styles.streamInfo}>
          <View style={styles.creatorRow}>
            <View style={styles.creatorAvatar}>
              <Text style={styles.creatorAvatarText}>
                {(item.creator_name || 'U')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.creatorInfo}>
              <Text style={styles.streamTitle} numberOfLines={2}>{item.title}</Text>
              <Text style={styles.creatorName}>{item.creator_name || 'Unknown'}</Text>
            </View>
          </View>
          {item.description ? (
            <Text style={styles.streamDesc} numberOfLines={2}>{item.description}</Text>
          ) : null}
          {item.status === 'scheduled' && item.scheduled_start && (
            <Text style={styles.scheduledTime}>
              {new Date(item.scheduled_start).toLocaleString()}
            </Text>
          )}
          {item.subscriber_count !== undefined && (
            <Text style={styles.subCount}>{formatViewerCount(item.subscriber_count)} subscribers</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live</Text>
      </View>

      <View style={styles.filterBar}>
        {[
          { key: 'live', label: 'Live Now', count: liveStreams.length },
          { key: 'scheduled', label: 'Upcoming', count: scheduledStreams.length },
          { key: 'all', label: 'All', count: streams.length },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, filter === tab.key && styles.activeFilter]}
            onPress={() => setFilter(tab.key as 'live' | 'scheduled' | 'all')}
          >
            <Text style={[styles.filterText, filter === tab.key && styles.activeFilterText]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={styles.filterCount}>
                <Text style={styles.filterCountText}>{tab.count}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading streams...</Text>
        </View>
      ) : streams.length === 0 ? (
        <View style={styles.emptyState}>
          <Radio size={48} color={Colors.text.muted} />
          <Text style={styles.emptyText}>No live streams</Text>
          <Text style={styles.emptySubtext}>
            {filter === 'live' ? 'No streams are live right now' : 'No scheduled streams'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={streams}
          keyExtractor={(item) => item.id}
          renderItem={renderStream}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingTop: Spacing.xl },
  backIcon: { padding: Spacing.sm },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginLeft: Spacing.sm },
  filterBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  filterTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg, backgroundColor: Colors.card },
  activeFilter: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  filterText: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium, color: Colors.text.muted },
  activeFilterText: { color: Colors.primary },
  filterCount: { backgroundColor: Colors.primary, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1, minWidth: 20, alignItems: 'center' },
  filterCountText: { fontSize: 10, fontWeight: FontWeights.bold, color: '#fff' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  emptyText: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  emptySubtext: { fontSize: FontSizes.sm, color: Colors.text.muted },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  streamCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  thumbnailContainer: { width: '100%', height: 180, backgroundColor: Colors.secondary, position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.2)' },
  liveBadge: { position: 'absolute', top: Spacing.sm, left: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 10, fontWeight: FontWeights.bold },
  scheduledBadge: { position: 'absolute', top: Spacing.sm, left: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(6, 182, 212, 0.8)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm },
  scheduledText: { color: '#fff', fontSize: 10, fontWeight: FontWeights.bold },
  premiumBadge: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  memberBadge: { position: 'absolute', top: Spacing.sm, right: 44, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, width: 24, height: 24, justifyContent: 'center', alignItems: 'center' },
  viewerBadge: { position: 'absolute', bottom: Spacing.sm, right: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm },
  viewerText: { color: '#fff', fontSize: 10, fontWeight: FontWeights.medium },
  streamInfo: { padding: Spacing.md },
  creatorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.xs },
  creatorAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  creatorAvatarText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  creatorInfo: { flex: 1 },
  streamTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: 2 },
  creatorName: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  streamDesc: { fontSize: FontSizes.sm, color: Colors.text.muted, lineHeight: 18, marginBottom: Spacing.xs },
  scheduledTime: { fontSize: FontSizes.xs, color: Colors.status.info, fontWeight: FontWeights.medium },
  subCount: { fontSize: FontSizes.xs, color: Colors.text.muted },
});
