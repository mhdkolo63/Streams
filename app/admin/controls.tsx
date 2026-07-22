import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Radio, DollarSign, Crown, Users, Gift, Download,
  UsersRound, Shield, Play, Square, Star, Trash2, Ban,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import {
  getPlatformSettings,
  updatePlatformSettings,
  approveCreatorMonetization,
  setCreatorEligibility,
  setUserPremium,
} from '../../lib/monetization';
import {
  getLiveStreams,
  featureStream,
  adminEndStream,
  adminRemoveChatMessages,
  formatViewerCount,
  type LiveStreamWithCreator,
} from '../../lib/live';
import type { PlatformSettings } from '../../lib/supabase';

export default function AdminControlsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [streams, setStreams] = useState<LiveStreamWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'features' | 'streams' | 'creators'>('features');

  const loadData = useCallback(async () => {
    try {
      const [s, liveStreams] = await Promise.all([
        getPlatformSettings(),
        getLiveStreams('all', 50),
      ]);
      setSettings(s);
      setStreams(liveStreams);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggle = async (key: keyof PlatformSettings, value: boolean) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
    try {
      await updatePlatformSettings({ [key]: value });
    } catch (e) {
      setSettings({ ...settings, [key]: !value });
      Alert.alert('Error', 'Failed to update settings.');
    }
  };

  const handleFeatureStream = async (streamId: string, featured: boolean) => {
    try {
      await featureStream(streamId, featured);
      loadData();
    } catch (e) {
      Alert.alert('Error', 'Failed to feature stream.');
    }
  };

  const handleEndStream = (streamId: string, title: string) => {
    Alert.alert('End Stream', `Force end "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          await adminEndStream(streamId);
          loadData();
        },
      },
    ]);
  };

  const handleRemoveChat = (streamId: string, title: string) => {
    Alert.alert('Remove Chat', `Remove all chat messages from "${title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await adminRemoveChatMessages(streamId);
          Alert.alert('Success', 'Chat messages removed.');
        },
      },
    ]);
  };

  const featureToggles = [
    { key: 'live_streaming_enabled' as const, label: 'Live Streaming', icon: Radio, color: Colors.primary },
    { key: 'monetization_enabled' as const, label: 'Monetization', icon: DollarSign, color: '#10B981' },
    { key: 'premium_videos_enabled' as const, label: 'Premium Videos', icon: Crown, color: '#FFD700' },
    { key: 'memberships_enabled' as const, label: 'Channel Memberships', icon: Users, color: '#06B6D4' },
    { key: 'donations_enabled' as const, label: 'Donations', icon: Gift, color: '#F472B6' },
    { key: 'downloads_enabled' as const, label: 'Downloads', icon: Download, color: '#8B5CF6' },
    { key: 'watch_party_enabled' as const, label: 'Watch Parties', icon: UsersRound, color: '#F97316' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Platform Controls</Text>
      </View>

      <View style={styles.tabBar}>
        {[
          { key: 'features', label: 'Features', icon: Shield },
          { key: 'streams', label: 'Live Streams', icon: Radio },
          { key: 'creators', label: 'Creators', icon: Users },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeSection === tab.key && styles.activeTab]}
            onPress={() => setActiveSection(tab.key as 'features' | 'streams' | 'creators')}
          >
            <tab.icon size={16} color={activeSection === tab.key ? Colors.primary : Colors.text.muted} />
            <Text style={[styles.tabText, activeSection === tab.key && styles.activeTabText]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeSection === 'features' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={styles.sectionDescription}>
              Enable or disable platform features. These control what creators and users can access.
            </Text>
            {featureToggles.map((toggle) => (
              <View key={toggle.key} style={styles.toggleCard}>
                <View style={styles.toggleInfo}>
                  <View style={[styles.toggleIcon, { backgroundColor: `${toggle.color}20` }]}>
                    <toggle.icon size={20} color={toggle.color} />
                  </View>
                  <View>
                    <Text style={styles.toggleLabel}>{toggle.label}</Text>
                    <Text style={styles.toggleStatus}>
                      {settings?.[toggle.key] ? 'Enabled' : 'Disabled'}
                    </Text>
                  </View>
                </View>
                <Switch
                  value={settings?.[toggle.key] ?? false}
                  onValueChange={(v) => handleToggle(toggle.key, v)}
                  trackColor={{ true: Colors.primary, false: Colors.border }}
                />
              </View>
            ))}
          </Animated.View>
        )}

        {activeSection === 'streams' && (
          <View>
            {streams.length === 0 ? (
              <View style={styles.emptyState}>
                <Radio size={48} color={Colors.text.muted} />
                <Text style={styles.emptyText}>No live streams</Text>
              </View>
            ) : (
              streams.map((stream) => (
                <View key={stream.id} style={styles.streamCard}>
                  <View style={styles.streamCardHeader}>
                    <View style={[styles.statusBadge, stream.status === 'live' && styles.liveBadge]}>
                      {stream.status === 'live' && <View style={styles.liveDot} />}
                      <Text style={[styles.statusText, stream.status === 'live' && styles.liveText]}>
                        {stream.status.toUpperCase()}
                      </Text>
                    </View>
                    {stream.is_featured && (
                      <View style={styles.featuredBadge}>
                        <Star size={12} color="#FFD700" fill="#FFD700" />
                        <Text style={styles.featuredText}>Featured</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.streamTitle}>{stream.title}</Text>
                  <Text style={styles.streamCreator}>{stream.creator_name || 'Unknown'}</Text>
                  {stream.status === 'live' && (
                    <Text style={styles.streamMeta}>
                      {formatViewerCount(stream.viewer_count)} watching
                    </Text>
                  )}
                  <View style={styles.streamActions}>
                    {stream.status === 'live' && (
                      <>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleFeatureStream(stream.id, !stream.is_featured)}
                        >
                          <Star size={14} color={stream.is_featured ? '#FFD700' : Colors.text.muted} />
                          <Text style={styles.actionText}>
                            {stream.is_featured ? 'Unfeature' : 'Feature'}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.dangerBtn]}
                          onPress={() => handleEndStream(stream.id, stream.title)}
                        >
                          <Square size={14} color={Colors.status.error} />
                          <Text style={[styles.actionText, { color: Colors.status.error }]}>End</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.dangerBtn]}
                          onPress={() => handleRemoveChat(stream.id, stream.title)}
                        >
                          <Trash2 size={14} color={Colors.status.error} />
                          <Text style={[styles.actionText, { color: Colors.status.error }]}>Clear Chat</Text>
                        </TouchableOpacity>
                      </>
                    )}
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => router.push(`/live/${stream.id}`)}
                    >
                      <Play size={14} color={Colors.text.primary} />
                      <Text style={styles.actionText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {activeSection === 'creators' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <Text style={styles.sectionDescription}>
              Manage creator monetization approvals and premium user status.
            </Text>
            <View style={styles.infoCard}>
              <DollarSign size={20} color="#10B981" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Monetization Approvals</Text>
                <Text style={styles.infoText}>
                  {settings?.monetization_enabled
                    ? 'Monetization is enabled. Creators can apply for monetization.'
                    : 'Monetization is disabled. Enable it to allow creator monetization.'}
                </Text>
              </View>
            </View>
            <View style={styles.infoCard}>
              <Crown size={20} color="#FFD700" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Premium Content</Text>
                <Text style={styles.infoText}>
                  {settings?.premium_videos_enabled
                    ? 'Premium videos are enabled. Creators can mark videos as premium.'
                    : 'Premium videos are disabled.'}
                </Text>
              </View>
            </View>
            <View style={styles.infoCard}>
              <Users size={20} color="#06B6D4" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Memberships</Text>
                <Text style={styles.infoText}>
                  {settings?.memberships_enabled
                    ? 'Channel memberships are enabled.'
                    : 'Channel memberships are disabled.'}
                </Text>
              </View>
            </View>
            <View style={styles.infoCard}>
              <Gift size={20} color="#F472B6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoTitle}>Donations</Text>
                <Text style={styles.infoText}>
                  {settings?.donations_enabled
                    ? 'Donations (Super Thanks, Super Chat, Tips) are enabled.'
                    : 'Donations are disabled.'}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingTop: Spacing.xl },
  backIcon: { padding: Spacing.sm },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginLeft: Spacing.sm },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.card },
  activeTab: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  tabText: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium, color: Colors.text.muted },
  activeTabText: { color: Colors.primary },
  content: { flex: 1, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  sectionDescription: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.md, lineHeight: 20 },
  toggleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  toggleInfo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  toggleIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  toggleLabel: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  toggleStatus: { fontSize: FontSizes.xs, color: Colors.text.muted },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  streamCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  streamCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, backgroundColor: Colors.secondary },
  liveBadge: { backgroundColor: Colors.primary },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  statusText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.muted },
  liveText: { color: '#fff' },
  featuredBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  featuredText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: '#FFD700' },
  streamTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: 4 },
  streamCreator: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginBottom: 2 },
  streamMeta: { fontSize: FontSizes.xs, color: Colors.text.muted, marginBottom: Spacing.sm },
  streamActions: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  dangerBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  actionText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium },
  infoCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  infoTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4 },
  infoText: { fontSize: FontSizes.xs, color: Colors.text.muted, lineHeight: 18 },
});
