import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing } from '@/constants/theme';

const { width: screenWidth } = Dimensions.get('window');

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function Skeleton({ width = '100%', height = 20, borderRadius = BorderRadius.md, style }: SkeletonProps) {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function VideoCardSkeleton({ size = 'medium' }: { size?: 'small' | 'medium' | 'large' }) {
  const getWidth = () => {
    switch (size) {
      case 'small':
        return screenWidth * 0.32;
      case 'large':
        return screenWidth - Spacing.lg * 2;
      default:
        return screenWidth * 0.42;
    }
  };

  const getImageHeight = () => {
    switch (size) {
      case 'small':
        return screenWidth * 0.19;
      case 'large':
        return screenWidth * 0.5;
      default:
        return screenWidth * 0.26;
    }
  };

  return (
    <View style={[styles.videoCardContainer, { width: getWidth() }]}>
      <Skeleton width="100%" height={getImageHeight()} borderRadius={BorderRadius.lg} />
      <View style={styles.videoCardDetails}>
        <Skeleton width="85%" height={14} borderRadius={BorderRadius.sm} />
        <Skeleton width="50%" height={12} borderRadius={BorderRadius.sm} style={styles.mtSm} />
      </View>
    </View>
  );
}

export function HeroSkeleton() {
  const height = screenWidth * 0.6;

  return (
    <View style={styles.heroContainer}>
      <Skeleton width={screenWidth} height={height} borderRadius={0} />
      <View style={styles.heroContent}>
        <View style={styles.heroBadge}>
          <Skeleton width={80} height={20} borderRadius={BorderRadius.sm} />
        </View>
        <Skeleton width="70%" height={36} borderRadius={BorderRadius.sm} style={styles.mbSm} />
        <View style={styles.heroMetaRow}>
          <Skeleton width={50} height={14} borderRadius={BorderRadius.sm} />
          <Skeleton width={80} height={14} borderRadius={BorderRadius.sm} style={styles.mlSm} />
          <Skeleton width={70} height={14} borderRadius={BorderRadius.sm} style={styles.mlSm} />
        </View>
        <Skeleton width="85%" height={50} borderRadius={BorderRadius.sm} style={styles.mtMd} />
        <View style={styles.heroButtons}>
          <Skeleton width={130} height={44} borderRadius={BorderRadius.md} />
          <Skeleton width={130} height={44} borderRadius={BorderRadius.md} style={styles.mlMd} />
        </View>
      </View>
    </View>
  );
}

export function VideoRowSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View style={styles.videoRowContainer}>
      <View style={styles.videoRowHeader}>
        <Skeleton width={150} height={22} borderRadius={BorderRadius.sm} />
      </View>
      <View style={styles.videoRowList}>
        {Array.from({ length: count }).map((_, i) => (
          <View key={i} style={styles.videoRowItem}>
            <VideoCardSkeleton size="medium" />
          </View>
        ))}
      </View>
    </View>
  );
}

export function NotificationSkeleton() {
  return (
    <View style={styles.notificationItem}>
      <Skeleton width={80} height={60} borderRadius={BorderRadius.md} />
      <View style={styles.notificationContent}>
        <Skeleton width="90%" height={16} borderRadius={BorderRadius.sm} />
        <Skeleton width="70%" height={14} borderRadius={BorderRadius.sm} style={styles.mtSm} />
        <Skeleton width={50} height={12} borderRadius={BorderRadius.sm} style={styles.mtSm} />
      </View>
    </View>
  );
}

export function HistoryItemSkeleton() {
  return (
    <View style={styles.historyItem}>
      <Skeleton width={120} height={68} borderRadius={BorderRadius.md} />
      <View style={styles.historyContent}>
        <Skeleton width="85%" height={16} borderRadius={BorderRadius.sm} />
        <Skeleton width={100} height={12} borderRadius={BorderRadius.sm} style={styles.mtSm} />
        <Skeleton width={60} height={10} borderRadius={BorderRadius.sm} style={styles.mtSm} />
      </View>
    </View>
  );
}

export function ProfileSkeleton() {
  return (
    <View style={styles.profileContainer}>
      <View style={styles.profileHeader}>
        <Skeleton width={80} height={80} borderRadius={40} />
        <View style={styles.profileInfo}>
          <Skeleton width={150} height={24} borderRadius={BorderRadius.sm} />
          <Skeleton width={200} height={14} borderRadius={BorderRadius.sm} style={styles.mtSm} />
        </View>
      </View>
      <View style={styles.statsRow}>
        <Skeleton width="30%" height={80} borderRadius={BorderRadius.md} />
        <Skeleton width="30%" height={80} borderRadius={BorderRadius.md} />
        <Skeleton width="30%" height={80} borderRadius={BorderRadius.md} />
      </View>
      <View style={styles.menuSection}>
        <Skeleton width="100%" height={50} borderRadius={BorderRadius.md} style={styles.mbSm} />
        <Skeleton width="100%" height={50} borderRadius={BorderRadius.md} style={styles.mbSm} />
        <Skeleton width="100%" height={50} borderRadius={BorderRadius.md} />
      </View>
    </View>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <View style={styles.adminContainer}>
      <View style={styles.adminHeader}>
        <Skeleton width={200} height={32} borderRadius={BorderRadius.sm} />
        <Skeleton width={150} height={16} borderRadius={BorderRadius.sm} style={styles.mtSm} />
      </View>
      <View style={styles.adminStats}>
        <Skeleton width="30%" height={100} borderRadius={BorderRadius.lg} />
        <Skeleton width="30%" height={100} borderRadius={BorderRadius.lg} />
        <Skeleton width="30%" height={100} borderRadius={BorderRadius.lg} />
      </View>
      <View style={styles.adminContent}>
        <Skeleton width="100%" height={50} borderRadius={BorderRadius.md} style={styles.mbMd} />
        <Skeleton width="100%" height={50} borderRadius={BorderRadius.md} style={styles.mbMd} />
        <Skeleton width="100%" height={50} borderRadius={BorderRadius.md} />
      </View>
    </View>
  );
}

export function SearchSkeleton() {
  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchInput}>
        <Skeleton width="100%" height={48} borderRadius={BorderRadius.full} />
      </View>
      <View style={styles.searchContent}>
        <Skeleton width={100} height={20} borderRadius={BorderRadius.sm} style={styles.mbMd} />
        <View style={styles.searchGrid}>
          {[1, 2, 3, 4].map((i) => (
            <VideoCardSkeleton key={i} size="medium" />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.tertiary,
  },
  videoCardContainer: {
    marginRight: Spacing.md,
  },
  videoCardDetails: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
  },
  mtSm: {
    marginTop: Spacing.xs,
  },
  mbSm: {
    marginBottom: Spacing.xs,
  },
  mMd: {
    marginTop: Spacing.md,
  },
  mtMd: {
    marginTop: Spacing.md,
  },
  mbMd: {
    marginBottom: Spacing.md,
  },
  mlSm: {
    marginLeft: Spacing.sm,
  },
  mlMd: {
    marginLeft: Spacing.md,
  },
  heroContainer: {
    width: '100%',
    position: 'relative',
  },
  heroContent: {
    position: 'absolute',
    bottom: Spacing.xl,
    left: Spacing.lg,
    right: Spacing.lg,
  },
  heroBadge: {
    marginBottom: Spacing.sm,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  heroButtons: {
    flexDirection: 'row',
    marginTop: Spacing.md,
  },
  videoRowContainer: {
    marginBottom: Spacing.xl,
  },
  videoRowHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  videoRowList: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
  },
  videoRowItem: {
    marginRight: Spacing.sm,
  },
  notificationItem: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  notificationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  historyContent: {
    flex: 1,
    justifyContent: 'center',
  },
  profileContainer: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  profileInfo: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  menuSection: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  adminContainer: {
    flex: 1,
  },
  adminHeader: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  adminStats: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    justifyContent: 'space-between',
  },
  adminContent: {
    padding: Spacing.lg,
  },
  searchContainer: {
    flex: 1,
  },
  searchInput: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  searchContent: {
    padding: Spacing.lg,
  },
  searchGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
});
