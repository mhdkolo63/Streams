import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Radio, Calendar, Clock, Image as ImageIcon,
  Crown, Lock, Users, Settings, Play, Square, Edit3, Trash2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import {
  createLiveStream,
  startLiveStream,
  endLiveStream,
  cancelLiveStream,
  updateLiveStream,
  updateStreamChatSettings,
  getCreatorLiveStreams,
  getPlatformSettings,
  formatStreamDuration,
  formatViewerCount,
} from '../../lib/live';
import type { LiveStream } from '../../lib/supabase';

export default function GoLivePage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [streamUrl, setStreamUrl] = useState('');
  const [isPremium, setIsPremium] = useState(false);
  const [isMemberOnly, setIsMemberOnly] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [chatEnabled, setChatEnabled] = useState(true);
  const [slowMode, setSlowMode] = useState(false);
  const [slowModeInterval, setSlowModeInterval] = useState(5);
  const [subscriberOnlyChat, setSubscriberOnlyChat] = useState(false);
  const [myStreams, setMyStreams] = useState<LiveStream[]>([]);
  const [loading, setLoading] = useState(false);
  const [liveStreamingEnabled, setLiveStreamingEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');

  const loadStreams = useCallback(async () => {
    if (!user) return;
    try {
      const streams = await getCreatorLiveStreams(user.id);
      setMyStreams(streams);
    } catch (e) {
      // silent
    }
  }, [user]);

  useEffect(() => {
    loadStreams();
    getPlatformSettings()
      .then((s) => setLiveStreamingEnabled(s?.live_streaming_enabled ?? true))
      .catch(() => {});
  }, [loadStreams]);

  const handleGoLive = async () => {
    if (!user) return;
    if (!title.trim()) {
      Alert.alert('Error', 'Please enter a stream title.');
      return;
    }
    setLoading(true);
    try {
      let scheduledStart: string | undefined;
      if (scheduleDate && scheduleTime) {
        const dt = new Date(`${scheduleDate}T${scheduleTime}`);
        if (dt.getTime() > Date.now()) {
          scheduledStart = dt.toISOString();
        }
      }
      const stream = await createLiveStream(user.id, {
        title: title.trim(),
        description: description.trim(),
        thumbnail_url: thumbnailUrl.trim() || undefined,
        stream_url: streamUrl.trim() || undefined,
        scheduled_start: scheduledStart,
        is_premium: isPremium,
        is_member_only: isMemberOnly,
      });
      Alert.alert('Success', scheduledStart ? 'Stream scheduled!' : 'You are now live!', [
        { text: 'OK', onPress: () => router.push(`/live/${stream.id}`) },
      ]);
      setTitle('');
      setDescription('');
      setThumbnailUrl('');
      setStreamUrl('');
      setScheduleDate('');
      setScheduleTime('');
      setIsPremium(false);
      setIsMemberOnly(false);
      loadStreams();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to start stream.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartStream = async (streamId: string) => {
    try {
      await startLiveStream(streamId);
      router.push(`/live/${streamId}`);
      loadStreams();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const handleEndStream = async (streamId: string) => {
    Alert.alert('End Stream', 'Are you sure you want to end this stream?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          await endLiveStream(streamId);
          loadStreams();
        },
      },
    ]);
  };

  const handleCancelStream = async (streamId: string) => {
    Alert.alert('Cancel Stream', 'Cancel this scheduled stream?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes',
        style: 'destructive',
        onPress: async () => {
          await cancelLiveStream(streamId);
          loadStreams();
        },
      },
    ]);
  };

  if (!liveStreamingEnabled) {
    return (
      <View style={styles.disabledContainer}>
        <Radio size={48} color={Colors.text.muted} />
        <Text style={styles.disabledTitle}>Live Streaming Disabled</Text>
        <Text style={styles.disabledText}>Live streaming is currently disabled by the administrator.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Live Streaming</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'create' && styles.activeTab]}
          onPress={() => setActiveTab('create')}
        >
          <Radio size={16} color={activeTab === 'create' ? Colors.primary : Colors.text.muted} />
          <Text style={[styles.tabText, activeTab === 'create' && styles.activeTabText]}>
            {scheduleDate ? 'Schedule' : 'Go Live'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'manage' && styles.activeTab]}
          onPress={() => setActiveTab('manage')}
        >
          <Settings size={16} color={activeTab === 'manage' ? Colors.primary : Colors.text.muted} />
          <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>My Streams</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'create' ? (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Stream Title *</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Give your stream a title..."
                placeholderTextColor={Colors.text.muted}
                maxLength={120}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your stream..."
                placeholderTextColor={Colors.text.muted}
                multiline
                numberOfLines={3}
                maxLength={500}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Thumbnail URL</Text>
              <TextInput
                style={styles.input}
                value={thumbnailUrl}
                onChangeText={setThumbnailUrl}
                placeholder="https://..."
                placeholderTextColor={Colors.text.muted}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Stream URL (RTMP/HLS)</Text>
              <TextInput
                style={styles.input}
                value={streamUrl}
                onChangeText={setStreamUrl}
                placeholder="https://... or rtmp://..."
                placeholderTextColor={Colors.text.muted}
              />
            </View>

            {/* Schedule Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Calendar size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Schedule (Optional)</Text>
              </View>
              <View style={styles.scheduleRow}>
                <View style={styles.scheduleInput}>
                  <Text style={styles.scheduleLabel}>Date</Text>
                  <TextInput
                    style={styles.input}
                    value={scheduleDate}
                    onChangeText={setScheduleDate}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
                <View style={styles.scheduleInput}>
                  <Text style={styles.scheduleLabel}>Time</Text>
                  <TextInput
                    style={styles.input}
                    value={scheduleTime}
                    onChangeText={setScheduleTime}
                    placeholder="HH:MM"
                    placeholderTextColor={Colors.text.muted}
                  />
                </View>
              </View>
            </View>

            {/* Access Control */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Lock size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Access Control</Text>
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Crown size={16} color="#FFD700" />
                  <Text style={styles.switchText}>Premium Stream</Text>
                </View>
                <Switch value={isPremium} onValueChange={setIsPremium} trackColor={{ true: Colors.primary, false: Colors.border }} />
              </View>
              <View style={styles.switchRow}>
                <View style={styles.switchLabel}>
                  <Users size={16} color={Colors.status.info} />
                  <Text style={styles.switchText}>Members Only</Text>
                </View>
                <Switch value={isMemberOnly} onValueChange={setIsMemberOnly} trackColor={{ true: Colors.primary, false: Colors.border }} />
              </View>
            </View>

            {/* Chat Settings */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Settings size={18} color={Colors.primary} />
                <Text style={styles.sectionTitle}>Chat Settings</Text>
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Chat Enabled</Text>
                <Switch value={chatEnabled} onValueChange={setChatEnabled} trackColor={{ true: Colors.primary, false: Colors.border }} />
              </View>
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Slow Mode</Text>
                <Switch value={slowMode} onValueChange={setSlowMode} trackColor={{ true: Colors.primary, false: Colors.border }} />
              </View>
              {slowMode && (
                <View style={styles.switchRow}>
                  <Text style={styles.switchText}>Interval (seconds)</Text>
                  <TextInput
                    style={[styles.input, styles.smallInput]}
                    value={String(slowModeInterval)}
                    onChangeText={(v) => setSlowModeInterval(Math.max(1, parseInt(v) || 5))}
                    keyboardType="numeric"
                  />
                </View>
              )}
              <View style={styles.switchRow}>
                <Text style={styles.switchText}>Subscriber-Only Chat</Text>
                <Switch value={subscriberOnlyChat} onValueChange={setSubscriberOnlyChat} trackColor={{ true: Colors.primary, false: Colors.border }} />
              </View>
            </View>

            <TouchableOpacity style={styles.goLiveBtn} onPress={handleGoLive} disabled={loading}>
              <Radio size={20} color="#fff" />
              <Text style={styles.goLiveText}>
                {loading ? 'Starting...' : scheduleDate ? 'Schedule Stream' : 'Go Live Now'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <View>
            {myStreams.length === 0 ? (
              <View style={styles.emptyState}>
                <Radio size={48} color={Colors.text.muted} />
                <Text style={styles.emptyText}>No streams yet</Text>
                <Text style={styles.emptySubtext}>Start or schedule your first live stream</Text>
              </View>
            ) : (
              myStreams.map((stream) => (
                <View key={stream.id} style={styles.streamCard}>
                  <View style={styles.streamCardHeader}>
                    <View style={[styles.streamStatusBadgeBase, stream.status === 'live' && styles.streamStatusBadgeLive, stream.status === 'scheduled' && styles.streamStatusBadgeScheduled]}>
                      {stream.status === 'live' && <View style={styles.liveDot} />}
                      <Text style={[styles.streamStatusTextBase, stream.status === 'live' && styles.streamStatusTextLive, stream.status === 'scheduled' && styles.streamStatusTextScheduled]}>
                        {stream.status.toUpperCase()}
                      </Text>
                    </View>
                    {stream.is_featured && (
                      <View style={styles.featuredBadge}>
                        <Text style={styles.featuredText}>Featured</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.streamCardTitle}>{stream.title}</Text>
                  {stream.description ? (
                    <Text style={styles.streamCardDesc} numberOfLines={2}>{stream.description}</Text>
                  ) : null}
                  <View style={styles.streamMeta}>
                    {stream.status === 'live' && (
                      <>
                        <View style={styles.metaItem}>
                          <Users size={14} color={Colors.text.muted} />
                          <Text style={styles.metaText}>{formatViewerCount(stream.viewer_count)} viewers</Text>
                        </View>
                        <View style={styles.metaItem}>
                          <Clock size={14} color={Colors.text.muted} />
                          <Text style={styles.metaText}>
                            {formatStreamDuration(stream.started_at, stream.ended_at)}
                          </Text>
                        </View>
                      </>
                    )}
                    {stream.status === 'scheduled' && stream.scheduled_start && (
                      <View style={styles.metaItem}>
                        <Calendar size={14} color={Colors.text.muted} />
                        <Text style={styles.metaText}>
                          {new Date(stream.scheduled_start).toLocaleString()}
                        </Text>
                      </View>
                    )}
                    {stream.status === 'ended' && (
                      <Text style={styles.metaText}>Stream ended</Text>
                    )}
                  </View>
                  <View style={styles.streamActions}>
                    {stream.status === 'scheduled' && (
                      <TouchableOpacity
                        style={styles.streamActionBtn}
                        onPress={() => handleStartStream(stream.id)}
                      >
                        <Play size={16} color="#fff" />
                        <Text style={styles.streamActionText}>Start</Text>
                      </TouchableOpacity>
                    )}
                    {stream.status === 'live' && (
                      <TouchableOpacity
                        style={[styles.streamActionBtn, styles.endBtn]}
                        onPress={() => handleEndStream(stream.id)}
                      >
                        <Square size={16} color="#fff" />
                        <Text style={styles.streamActionText}>End</Text>
                      </TouchableOpacity>
                    )}
                    {stream.status === 'scheduled' && (
                      <TouchableOpacity
                        style={[styles.streamActionBtn, styles.cancelBtn]}
                        onPress={() => handleCancelStream(stream.id)}
                      >
                        <Trash2 size={16} color={Colors.status.error} />
                        <Text style={[styles.streamActionText, styles.cancelText]}>Cancel</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={styles.streamActionBtn}
                      onPress={() => router.push(`/live/${stream.id}`)}
                    >
                      <Text style={styles.streamActionText}>View</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  disabledContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: Spacing.md },
  disabledTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  disabledText: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingTop: Spacing.xl },
  backIcon: { padding: Spacing.sm },
  headerTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary, marginLeft: Spacing.sm },
  tabBar: { flexDirection: 'row', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.card },
  activeTab: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  tabText: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium, color: Colors.text.muted },
  activeTabText: { color: Colors.primary },
  content: { flex: 1, paddingHorizontal: Spacing.lg },
  inputGroup: { marginBottom: Spacing.md },
  label: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.secondary, marginBottom: Spacing.xs },
  input: { backgroundColor: Colors.card, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, color: Colors.text.primary, fontSize: FontSizes.sm, borderWidth: 1, borderColor: Colors.border },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  section: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  sectionTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  scheduleRow: { flexDirection: 'row', gap: Spacing.md },
  scheduleInput: { flex: 1 },
  scheduleLabel: { fontSize: FontSizes.xs, color: Colors.text.muted, marginBottom: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm },
  switchLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  switchText: { fontSize: FontSizes.sm, color: Colors.text.primary },
  smallInput: { width: 80, paddingVertical: 4 },
  goLiveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, paddingVertical: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.xl },
  goLiveText: { color: '#fff', fontSize: FontSizes.md, fontWeight: FontWeights.bold },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.md },
  emptyText: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  emptySubtext: { fontSize: FontSizes.sm, color: Colors.text.muted },
  streamCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  streamCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  streamStatusBadgeBase: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, backgroundColor: Colors.secondary },
  streamStatusBadgeLive: { backgroundColor: Colors.primary },
  streamStatusBadgeScheduled: { backgroundColor: 'rgba(6, 182, 212, 0.15)' },
  streamStatusTextBase: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.muted },
  streamStatusTextLive: { color: '#fff' },
  streamStatusTextScheduled: { color: Colors.status.info },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  featuredBadge: { backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  featuredText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: '#FFD700' },
  streamCardTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: 4 },
  streamCardDesc: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.sm },
  streamMeta: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  streamActions: { flexDirection: 'row', gap: Spacing.sm },
  streamActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.secondary, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  streamActionText: { fontSize: FontSizes.sm, color: '#fff', fontWeight: FontWeights.medium },
  endBtn: { backgroundColor: Colors.status.error },
  cancelBtn: { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: Colors.status.error },
  cancelText: { color: Colors.status.error },
  backBtn: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md },
  backBtnText: { color: Colors.text.primary, fontSize: FontSizes.sm },
});
