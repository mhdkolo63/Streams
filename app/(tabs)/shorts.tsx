import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  RefreshControl,
  ViewToken,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Play, Film } from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase, Video } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

export default function ShortsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [shorts, setShorts] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const fetchShorts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('status', 'published')
        .order('views_count', { ascending: false })
        .limit(20);

      if (error) throw error;

      const candidateShorts = (data as Video[]) || [];
      const filtered = candidateShorts.filter(
        (v) => v.aspect_ratio === '9:16' || (v.duration > 0 && v.duration <= 60)
      );
      setShorts(filtered.length > 0 ? filtered : candidateShorts.slice(0, 10));
    } catch (error) {
      console.error('Error fetching shorts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShorts();
  }, [fetchShorts]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchShorts();
    setRefreshing(false);
  }, [fetchShorts]);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = { itemVisiblePercentThreshold: 60 };

  const formatCount = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return `${n}`;
  };

  const renderShort = ({ item, index }: { item: Video; index: number }) => (
    <Animated.View
      entering={FadeIn.delay(index * 50).duration(300)}
      style={styles.shortContainer}
    >
      <View style={styles.shortCard}>
        {item.thumbnail_url ? (
          <Animated.Image
            source={{ uri: item.thumbnail_url }}
            style={styles.thumbnail as any}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.thumbnailPlaceholder}>
            <Film size={48} color={Colors.text.muted} />
          </View>
        )}
        <View style={styles.overlay} />
        <View style={styles.playBadge}>
          <Play size={20} color={Colors.text.primary} fill={Colors.text.primary} />
        </View>
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
          <Text style={styles.meta}>{formatCount(item.views_count)} views</Text>
        </View>
      </View>
    </Animated.View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Play size={24} color={Colors.primary} fill={Colors.primary} />
          <Text style={styles.headerTitle}>Shorts</Text>
        </View>
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={[styles.shortContainer, { opacity: 0.4 }]}>
              <View style={[styles.shortCard, { backgroundColor: Colors.card }]} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (shorts.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Play size={24} color={Colors.primary} fill={Colors.primary} />
          <Text style={styles.headerTitle}>Shorts</Text>
        </View>
        <EmptyState
          type="custom"
          icon={<Play size={64} color={Colors.text.muted} />}
          title="No shorts yet"
          message="Short vertical videos will appear here. Creators can upload 60-second clips to share with the community."
          onAction={() => router.push('/')}
          actionLabel="Browse Videos"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Play size={24} color={Colors.primary} fill={Colors.primary} />
        <Text style={styles.headerTitle}>Shorts</Text>
        <Text style={styles.count}>{shorts.length}</Text>
      </View>
      <FlatList
        data={shorts}
        keyExtractor={(item) => item.id}
        renderItem={renderShort}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={onViewableItemsChanged}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 60,
    paddingHorizontal: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginLeft: Spacing.sm,
  },
  count: {
    fontSize: FontSizes.md,
    color: Colors.text.muted,
    marginLeft: Spacing.sm,
  },
  loadingContainer: {
    flex: 1,
  },
  list: {
    paddingBottom: Spacing.xxl,
  },
  row: {
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  shortContainer: {
    width: (width - Spacing.md * 3) / 2,
  marginBottom: Spacing.sm,
  borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  shortCard: {
    width: '100%',
    aspectRatio: 9 / 16,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  playBadge: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: 2,
  },
  meta: {
    fontSize: FontSizes.xs,
    color: Colors.text.secondary,
  },
});
