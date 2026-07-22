import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, DollarSign, Crown, Gift, Users, TrendingUp,
  Eye, Clock, Radio, Repeat, Download, BarChart3,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import {
  getCreatorAnalyticsExtended,
  getPlatformSettings,
  formatRevenue,
  type CreatorAnalyticsExtended,
} from '../../lib/monetization';
import { formatDuration } from '../../lib/creators';

export default function MonetizationDashboardPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [analytics, setAnalytics] = useState<CreatorAnalyticsExtended | null>(null);
  const [settings, setSettings] = useState<{ monetization_enabled: boolean; premium_videos_enabled: boolean; memberships_enabled: boolean; donations_enabled: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAnalytics = useCallback(async () => {
    if (!user) return;
    try {
      const [a, s] = await Promise.all([
        getCreatorAnalyticsExtended(user.id),
        getPlatformSettings(),
      ]);
      setAnalytics(a);
      setSettings({
        monetization_enabled: s?.monetization_enabled ?? false,
        premium_videos_enabled: s?.premium_videos_enabled ?? false,
        memberships_enabled: s?.memberships_enabled ?? false,
        donations_enabled: s?.donations_enabled ?? false,
      });
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const monetizationEnabled = settings?.monetization_enabled ?? false;
  const monetizationApproved = profile?.monetization_approved ?? false;

  const revenueCards = [
    { label: 'Estimated Revenue', value: formatRevenue(analytics?.revenue.estimated ?? 0), icon: DollarSign, color: '#10B981', enabled: monetizationEnabled },
    { label: 'Ad Revenue', value: formatRevenue(analytics?.revenue.ad ?? 0), icon: TrendingUp, color: '#06B6D4', enabled: monetizationEnabled },
    { label: 'Premium Revenue', value: formatRevenue(analytics?.revenue.premium ?? 0), icon: Crown, color: '#FFD700', enabled: monetizationEnabled && (settings?.premium_videos_enabled ?? false) },
    { label: 'Donations', value: formatRevenue(analytics?.revenue.donations ?? 0), icon: Gift, color: '#F472B6', enabled: monetizationEnabled && (settings?.donations_enabled ?? false) },
    { label: 'Memberships', value: formatRevenue(analytics?.revenue.memberships ?? 0), icon: Users, color: '#8B5CF6', enabled: monetizationEnabled && (settings?.memberships_enabled ?? false) },
  ];

  const analyticsCards = [
    { label: 'Total Views', value: formatCount(analytics?.totalViews ?? 0), icon: Eye, color: Colors.primary },
    { label: 'Avg Watch Time', value: formatDuration(analytics?.avgWatchTime ?? 0), icon: Clock, color: '#06B6D4' },
    { label: 'Total Watch Time', value: formatDuration(analytics?.totalWatchTime ?? 0), icon: Clock, color: '#8B5CF6' },
    { label: 'Live Viewers', value: formatCount(analytics?.liveViewers ?? 0), icon: Radio, color: '#EF4444' },
    { label: 'Total Streams', value: `${analytics?.totalStreams ?? 0}`, icon: Radio, color: '#F97316' },
    { label: 'Returning Viewers', value: formatCount(analytics?.returningViewers ?? 0), icon: Repeat, color: '#10B981' },
    { label: 'Downloads', value: formatCount(analytics?.totalDownloads ?? 0), icon: Download, color: '#6366F1' },
    { label: 'Subscribers', value: formatCount(analytics?.totalSubscribers ?? 0), icon: Users, color: '#EC4899' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Monetization & Analytics</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Banner */}
        {!monetizationEnabled && (
          <View style={styles.statusBanner}>
            <DollarSign size={20} color={Colors.text.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Monetization Disabled</Text>
              <Text style={styles.statusText}>
                Monetization is currently disabled by the administrator. Revenue figures are placeholders.
              </Text>
            </View>
          </View>
        )}
        {monetizationEnabled && !monetizationApproved && (
          <View style={styles.statusBanner}>
            <Clock size={20} color={Colors.status.warning} />
            <View style={{ flex: 1 }}>
              <Text style={styles.statusTitle}>Pending Approval</Text>
              <Text style={styles.statusText}>
                Your channel is awaiting monetization approval from the administrator.
              </Text>
            </View>
          </View>
        )}
        {monetizationEnabled && monetizationApproved && (
          <View style={[styles.statusBanner, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
            <DollarSign size={20} color="#10B981" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.statusTitle, { color: '#10B981' }]}>Monetization Active</Text>
              <Text style={styles.statusText}>
                Your channel is monetized. Revenue tracking is active.
              </Text>
            </View>
          </View>
        )}

        {/* Revenue Section */}
        <Animated.View entering={FadeInDown.duration(300)}>
          <Text style={styles.sectionTitle}>Revenue Overview</Text>
          <View style={styles.revenueGrid}>
            {revenueCards.map((card, i) => (
              <View
                key={card.label}
                style={[styles.revenueCard, !card.enabled && styles.disabledCard]}
              >
                <View style={[styles.revenueIcon, { backgroundColor: `${card.color}20` }]}>
                  <card.icon size={18} color={card.color} />
                </View>
                <Text style={styles.revenueValue}>{card.value}</Text>
                <Text style={styles.revenueLabel}>{card.label}</Text>
                {!card.enabled && <Text style={styles.disabledLabel}>Not Enabled</Text>}
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Analytics Section */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <Text style={styles.sectionTitle}>Advanced Analytics</Text>
          <View style={styles.analyticsGrid}>
            {analyticsCards.map((card) => (
              <View key={card.label} style={styles.analyticsCard}>
                <View style={[styles.analyticsIcon, { backgroundColor: `${card.color}20` }]}>
                  <card.icon size={16} color={card.color} />
                </View>
                <Text style={styles.analyticsValue}>{card.value}</Text>
                <Text style={styles.analyticsLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Future Features */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <View style={styles.futureCard}>
            <BarChart3 size={20} color={Colors.text.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.futureTitle}>Watch Party Participation</Text>
              <Text style={styles.futureText}>Track viewer engagement during watch parties.</Text>
            </View>
          </View>
          <View style={styles.futureCard}>
            <Crown size={20} color={Colors.text.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.futureTitle}>Premium Subscriptions</Text>
              <Text style={styles.futureText}>Offer premium memberships to your audience.</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingTop: Spacing.xl },
  backIcon: { padding: Spacing.sm },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginLeft: Spacing.sm },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  statusTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.status.warning, marginBottom: 2 },
  statusText: { fontSize: FontSizes.xs, color: Colors.text.muted, lineHeight: 16 },
  sectionTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm, marginTop: Spacing.md },
  revenueGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  revenueCard: { width: '48%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  disabledCard: { opacity: 0.5 },
  revenueIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  revenueValue: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  revenueLabel: { fontSize: FontSizes.xs, color: Colors.text.muted },
  disabledLabel: { fontSize: 10, color: Colors.status.warning, fontWeight: FontWeights.semibold },
  analyticsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  analyticsCard: { width: '48%', flexGrow: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  analyticsIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  analyticsValue: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary },
  analyticsLabel: { fontSize: FontSizes.xs, color: Colors.text.muted },
  futureCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  futureTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 2 },
  futureText: { fontSize: FontSizes.xs, color: Colors.text.muted },
});
