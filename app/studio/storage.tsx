import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  HardDrive,
  Film,
  Play,
  FileVideo,
  TrendingUp,
  AlertCircle,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { getStorageUsage, formatBytes, type StorageUsage } from '@/lib/creators';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const STORAGE_LIMIT_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB per creator

export default function StudioStorageScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsage = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const data = await getStorageUsage(user.id);
      setUsage(data);
    } catch (error) {
      console.error('Error fetching storage:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsage();
    setRefreshing(false);
  }, [fetchUsage]);

  const usedPercent = usage ? Math.min(100, (usage.usedBytes / STORAGE_LIMIT_BYTES) * 100) : 0;
  const remainingBytes = STORAGE_LIMIT_BYTES - (usage?.usedBytes || 0);
  const isNearLimit = usedPercent > 80;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        >
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Storage</Text>
          </View>

          {/* Main Storage Card */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.storageCard}>
            <View style={styles.storageHeader}>
              <View style={[styles.storageIcon, isNearLimit && styles.storageIconWarning]}>
                <HardDrive size={28} color={isNearLimit ? Colors.status.warning : Colors.primary} />
              </View>
              <View style={styles.storageHeaderInfo}>
                <Text style={styles.storageUsed}>{formatBytes(usage?.usedBytes || 0)}</Text>
                <Text style={styles.storageLimit}>of {formatBytes(STORAGE_LIMIT_BYTES)} used</Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  { width: `${usedPercent}%` },
                  isNearLimit && styles.progressFillWarning,
                ]}
              />
            </View>

            <View style={styles.storageStats}>
              <View style={styles.storageStatItem}>
                <Text style={styles.storageStatValue}>{formatBytes(remainingBytes)}</Text>
                <Text style={styles.storageStatLabel}>Remaining</Text>
              </View>
              <View style={styles.storageStatDivider} />
              <View style={styles.storageStatItem}>
                <Text style={styles.storageStatValue}>{usage?.fileCount || 0}</Text>
                <Text style={styles.storageStatLabel}>Files</Text>
              </View>
              <View style={styles.storageStatDivider} />
              <View style={styles.storageStatItem}>
                <Text style={styles.storageStatValue}>{usage?.videoCount || 0}</Text>
                <Text style={styles.storageStatLabel}>Videos</Text>
              </View>
            </View>

            {isNearLimit && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.warningBanner}>
                <AlertCircle size={16} color={Colors.status.warning} />
                <Text style={styles.warningText}>You've used {Math.round(usedPercent)}% of your storage. Consider deleting old content.</Text>
              </Animated.View>
            )}
          </Animated.View>

          {/* Breakdown */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Storage Breakdown</Text>
            <View style={styles.breakdownList}>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: 'rgba(229, 9, 20, 0.1)' }]}>
                  <FileVideo size={18} color={Colors.primary} />
                </View>
                <View style={styles.breakdownInfo}>
                  <Text style={styles.breakdownLabel}>Video Files</Text>
                  <Text style={styles.breakdownValue}>{usage?.videoCount || 0} files</Text>
                </View>
                <Text style={styles.breakdownSize}>{formatBytes(usage?.usedBytes || 0)}</Text>
              </View>
              <View style={styles.breakdownItem}>
                <View style={[styles.breakdownIcon, { backgroundColor: 'rgba(59, 130, 246, 0.1)' }]}>
                  <Film size={18} color="#3B82F6" />
                </View>
                <View style={styles.breakdownInfo}>
                  <Text style={styles.breakdownLabel}>Thumbnails</Text>
                  <Text style={styles.breakdownValue}>{usage?.fileCount || 0} files</Text>
                </View>
                <Text style={styles.breakdownSize}>—</Text>
              </View>
            </View>
          </Animated.View>

          {/* Tips */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Storage Tips</Text>
            <View style={styles.tipsList}>
              <View style={styles.tipItem}>
                <TrendingUp size={16} color={Colors.primary} />
                <Text style={styles.tipText}>Delete unused videos to free up space</Text>
              </View>
              <View style={styles.tipItem}>
                <Play size={16} color="#3B82F6" />
                <Text style={styles.tipText}>Shorts use less storage than long videos</Text>
              </View>
              <View style={styles.tipItem}>
                <HardDrive size={16} color="#10B981" />
                <Text style={styles.tipText}>Compress videos before uploading to save space</Text>
              </View>
            </View>
          </Animated.View>

          {/* Manage Content */}
          <TouchableOpacity
            style={styles.manageButton}
            onPress={() => router.push('/studio/content')}
            activeOpacity={0.7}
          >
            <Film size={18} color={Colors.primary} />
            <Text style={styles.manageButtonText}>Manage My Content</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.xl },
  backButton: { padding: Spacing.xs },
  headerTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  storageCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  storageHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  storageIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(229, 9, 20, 0.1)', justifyContent: 'center', alignItems: 'center' },
  storageIconWarning: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  storageHeaderInfo: { flex: 1 },
  storageUsed: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  storageLimit: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  progressTrack: { height: 12, backgroundColor: Colors.tertiary, borderRadius: BorderRadius.full, overflow: 'hidden', marginBottom: Spacing.lg },
  progressFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: BorderRadius.full },
  progressFillWarning: { backgroundColor: Colors.status.warning },
  storageStats: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  storageStatItem: { alignItems: 'center', gap: 4 },
  storageStatValue: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  storageStatLabel: { fontSize: FontSizes.xs, color: Colors.text.muted },
  storageStatDivider: { width: 1, height: 32, backgroundColor: Colors.border },
  warningBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg, padding: Spacing.md, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: BorderRadius.md },
  warningText: { flex: 1, fontSize: FontSizes.sm, color: Colors.status.warning },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.md },
  breakdownList: { gap: Spacing.sm },
  breakdownItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  breakdownIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  breakdownInfo: { flex: 1 },
  breakdownLabel: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  breakdownValue: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  breakdownSize: { fontSize: FontSizes.md, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
  tipsList: { gap: Spacing.sm },
  tipItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  tipText: { flex: 1, fontSize: FontSizes.sm, color: Colors.text.secondary },
  manageButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, backgroundColor: 'rgba(229, 9, 20, 0.1)', borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: 'rgba(229, 9, 20, 0.2)' },
  manageButtonText: { fontSize: FontSizes.md, color: Colors.primary, fontWeight: FontWeights.semibold },
});
