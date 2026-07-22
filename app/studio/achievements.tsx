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
  Award,
  Film,
  Eye,
  Users,
  ThumbsUp,
  Star,
  Crown,
  Zap,
  Trophy,
  Medal,
  Flame,
  Target,
  TrendingUp,
  Lock,
  CheckCircle2,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { getCreatorStats, type CreatorDashboardStats } from '@/lib/creators';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

interface Achievement {
  id: string;
  icon: any;
  title: string;
  description: string;
  goal: number;
  current: number;
  color: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export default function StudioAchievementsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<CreatorDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const s = await getCreatorStats(user.id);
      setStats(s);
    } catch (error) {
      console.error('Error fetching stats:', error);
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

  const achievements: Achievement[] = [
    { id: 'first_upload', icon: Film, title: 'First Upload', description: 'Upload your first video', goal: 1, current: (stats?.totalUploads ?? 0) >= 1 ? 1 : 0, color: '#10B981', tier: 'bronze' },
    { id: '10_uploads', icon: Film, title: 'Getting Started', description: 'Upload 10 videos', goal: 10, current: Math.min(stats?.totalUploads ?? 0, 10), color: '#3B82F6', tier: 'silver' },
    { id: '50_uploads', icon: Film, title: 'Content Machine', description: 'Upload 50 videos', goal: 50, current: Math.min(stats?.totalUploads ?? 0, 50), color: '#A855F7', tier: 'gold' },
    { id: '100_views', icon: Eye, title: 'First Hundred', description: 'Reach 100 total views', goal: 100, current: Math.min(stats?.totalViews ?? 0, 100), color: '#F59E0B', tier: 'bronze' },
    { id: '1000_views', icon: Eye, title: 'Going Viral', description: 'Reach 1,000 total views', goal: 1000, current: Math.min(stats?.totalViews ?? 0, 1000), color: '#EC4899', tier: 'silver' },
    { id: '10000_views', icon: TrendingUp, title: 'Rising Star', description: 'Reach 10,000 total views', goal: 10000, current: Math.min(stats?.totalViews ?? 0, 10000), color: '#06B6D4', tier: 'gold' },
    { id: '100_subs', icon: Users, title: 'Building Community', description: 'Reach 100 subscribers', goal: 100, current: Math.min(stats?.subscribers ?? 0, 100), color: '#F97316', tier: 'silver' },
    { id: '1000_subs', icon: Users, title: 'Creator Milestone', description: 'Reach 1,000 subscribers', goal: 1000, current: Math.min(stats?.subscribers ?? 0, 1000), color: '#E50914', tier: 'gold' },
    { id: '10000_subs', icon: Crown, title: 'Diamond Creator', description: 'Reach 10,000 subscribers', goal: 10000, current: Math.min(stats?.subscribers ?? 0, 10000), color: '#A855F7', tier: 'diamond' },
    { id: '100_likes', icon: ThumbsUp, title: 'Crowd Pleaser', description: 'Get 100 total likes', goal: 100, current: Math.min(stats?.totalLikes ?? 0, 100), color: '#22C55E', tier: 'bronze' },
    { id: '1000_likes', icon: ThumbsUp, title: 'Fan Favorite', description: 'Get 1,000 total likes', goal: 1000, current: Math.min(stats?.totalLikes ?? 0, 1000), color: '#8B5CF6', tier: 'silver' },
    { id: 'first_short', icon: Zap, title: 'Short Form', description: 'Upload your first short', goal: 1, current: (stats?.totalShorts ?? 0) >= 1 ? 1 : 0, color: '#3B82F6', tier: 'bronze' },
  ];

  const unlockedCount = achievements.filter((a) => a.current >= a.goal).length;
  const tierConfig: Record<Achievement['tier'], { color: string; icon: any; label: string }> = {
    bronze: { color: '#CD7F32', icon: Medal, label: 'Bronze' },
    silver: { color: '#C0C0C0', icon: Medal, label: 'Silver' },
    gold: { color: '#FFD700', icon: Trophy, label: 'Gold' },
    diamond: { color: '#B9F2FF', icon: Crown, label: 'Diamond' },
  };

  const formatCount = (n: number): string => {
    if (n >= 10000) return `${(n / 1000).toFixed(0)}K`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return `${n}`;
  };

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
            <Text style={styles.headerTitle}>Achievements</Text>
          </View>

          {/* Summary Card */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.summaryCard}>
            <View style={styles.summaryIconWrap}>
              <Trophy size={32} color={Colors.primary} />
            </View>
            <View style={styles.summaryInfo}>
              <Text style={styles.summaryTitle}>{unlockedCount} / {achievements.length}</Text>
              <Text style={styles.summaryLabel}>Achievements Unlocked</Text>
            </View>
            <View style={styles.progressRing}>
              <Text style={styles.progressRingText}>{Math.round((unlockedCount / achievements.length) * 100)}%</Text>
            </View>
          </Animated.View>

          {/* Tier Legend */}
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.tierLegend}>
            {(Object.keys(tierConfig) as Achievement['tier'][]).map((tier) => {
              const TierIcon = tierConfig[tier].icon;
              return (
                <View key={tier} style={styles.tierBadge}>
                  <TierIcon size={14} color={tierConfig[tier].color} />
                  <Text style={[styles.tierLabel, { color: tierConfig[tier].color }]}>{tierConfig[tier].label}</Text>
                </View>
              );
            })}
          </Animated.View>

          {/* Achievement Cards */}
          <View style={styles.achievementsGrid}>
            {achievements.map((achievement, i) => {
              const isUnlocked = achievement.current >= achievement.goal;
              const progress = Math.min(100, (achievement.current / achievement.goal) * 100);
              const tierInfo = tierConfig[achievement.tier];

              return (
                <Animated.View
                  key={achievement.id}
                  entering={ZoomIn.delay(i * 40).duration(400)}
                  style={[styles.achievementCard, isUnlocked && styles.unlockedCard]}
                >
                  <View style={[styles.achievementIconWrap, { backgroundColor: isUnlocked ? achievement.color + '20' : Colors.tertiary }]}>
                    {isUnlocked ? (
                      <achievement.icon size={28} color={achievement.color} />
                    ) : (
                      <Lock size={24} color={Colors.text.muted} />
                    )}
                    {isUnlocked && (
                      <View style={styles.unlockedCheck}>
                        <CheckCircle2 size={16} color={Colors.status.success} />
                      </View>
                    )}
                  </View>
                  <Text style={styles.achievementTitle} numberOfLines={1}>{achievement.title}</Text>
                  <Text style={styles.achievementDesc} numberOfLines={2}>{achievement.description}</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBar}>
                      <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: isUnlocked ? achievement.color : Colors.text.muted }]} />
                    </View>
                    <Text style={styles.progressText}>
                      {formatCount(achievement.current)} / {formatCount(achievement.goal)}
                    </Text>
                  </View>
                  <View style={[styles.tierTag, { backgroundColor: tierInfo.color + '20' }]}>
                    <tierInfo.icon size={10} color={tierInfo.color} />
                    <Text style={[styles.tierTagText, { color: tierInfo.color }]}>{tierInfo.label}</Text>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          {/* Motivational CTA */}
          <Animated.View entering={FadeInDown.delay(400).duration(300)} style={styles.ctaCard}>
            <Flame size={24} color="#F59E0B" />
            <Text style={styles.ctaTitle}>Keep creating to unlock more!</Text>
            <Text style={styles.ctaDesc}>Upload videos, get views, and grow your community to earn new achievements.</Text>
            <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/studio/upload')}>
              <Film size={16} color={Colors.text.primary} />
              <Text style={styles.ctaBtnText}>Upload Now</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.lg, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.xl, padding: Spacing.lg, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  summaryIconWrap: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(229, 9, 20, 0.1)', justifyContent: 'center', alignItems: 'center' },
  summaryInfo: { flex: 1 },
  summaryTitle: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  summaryLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, marginTop: 2 },
  progressRing: { width: 56, height: 56, borderRadius: 28, borderWidth: 4, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  progressRingText: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.primary },
  tierLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.card, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.full },
  tierLabel: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.lg },
  achievementCard: { width: (Dimensions.get('window').width - Spacing.lg * 2 - Spacing.sm) / 2, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: Spacing.xs },
  unlockedCard: { borderColor: 'rgba(229, 9, 20, 0.3)', backgroundColor: 'rgba(229, 9, 20, 0.03)' },
  achievementIconWrap: { width: 56, height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', position: 'relative' },
  unlockedCheck: { position: 'absolute', top: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center' },
  achievementTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  achievementDesc: { fontSize: FontSizes.xs, color: Colors.text.muted, lineHeight: 14, minHeight: 28 },
  progressContainer: { marginTop: Spacing.xs },
  progressBar: { height: 4, backgroundColor: Colors.tertiary, borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 2 },
  progressText: { fontSize: 10, color: Colors.text.muted, fontWeight: FontWeights.medium },
  tierTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: BorderRadius.sm },
  tierTagText: { fontSize: 9, fontWeight: FontWeights.bold },
  ctaCard: { alignItems: 'center', gap: Spacing.sm, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: BorderRadius.lg, padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(245, 158, 11, 0.3)' },
  ctaTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: '#F59E0B' },
  ctaDesc: { fontSize: FontSizes.sm, color: Colors.text.secondary, textAlign: 'center', lineHeight: 18 },
  ctaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, marginTop: Spacing.xs },
  ctaBtnText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
});

