import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
  Alert,
  Share,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft, Eye, Users, Radio, Share2, MoreVertical,
  Crown, Shield, Lock,
} from 'lucide-react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import {
  getLiveStreamById,
  subscribeToStreamUpdates,
  formatStreamDuration,
  formatViewerCount,
  type LiveStreamWithCreator,
} from '../../lib/live';
import { isSubscribed } from '../../lib/creators/subscriptions';
import LiveChat from '../../components/LiveChat';
import { CachedImage } from '../../components/CachedImage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VIDEO_HEIGHT = Math.round(SCREEN_WIDTH * 9 / 16);

export default function LiveStreamWatchPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, profile } = useAuth();
  const [stream, setStream] = useState<LiveStreamWithCreator | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [duration, setDuration] = useState('0:00');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const isCreator = user?.id === stream?.creator_id;
  const isAdmin = profile?.is_admin === true;
  const isPremiumLocked = stream?.is_premium && !profile?.is_premium && !isCreator && !isAdmin;

  const loadStream = useCallback(async () => {
    if (!id) return;
    try {
      const data = await getLiveStreamById(id);
      setStream(data);
      if (data && user) {
        const subscribed = await isSubscribed(user.id, data.creator_id);
        setIsSubscriber(subscribed);
      }
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id, user]);

  useEffect(() => {
    loadStream();
  }, [loadStream]);

  useEffect(() => {
    if (!id) return;
    const subscription = subscribeToStreamUpdates(id, (payload) => {
      if (payload.eventType === 'UPDATE' && payload.new) {
        setStream((prev) => prev ? { ...prev, ...payload.new } : prev);
      }
    });
    return () => { subscription.unsubscribe(); };
  }, [id]);

  useEffect(() => {
    if (stream?.status === 'live' && stream.started_at) {
      const interval = setInterval(() => {
        setDuration(formatStreamDuration(stream.started_at, stream.ended_at));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [stream?.status, stream?.started_at, stream?.ended_at]);

  const handleShare = async () => {
    if (!stream) return;
    const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/live/${stream.id}`;
    try {
      await Share.share({ message: `Watch ${stream.title} live on StreamWorld: ${url}` });
    } catch (e) {
      // silent
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading stream...</Text>
      </View>
    );
  }

  if (!stream) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Stream not found</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Video Player Area */}
      <View style={styles.videoContainer}>
        {stream.status === 'live' && stream.stream_url && !isPremiumLocked ? (
          <video
            ref={videoRef}
            src={stream.stream_url}
            autoPlay
            muted
            playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <View style={styles.placeholderVideo}>
            <CachedImage uri={stream.thumbnail_url || ''} style={styles.thumbnail} />
            <View style={styles.overlayGradient} />
            {stream.status === 'scheduled' && (
              <View style={styles.scheduledOverlay}>
                <Radio size={32} color={Colors.text.muted} />
                <Text style={styles.scheduledText}>Stream starts soon</Text>
                {stream.scheduled_start && (
                  <Text style={styles.scheduledTime}>
                    {new Date(stream.scheduled_start).toLocaleString()}
                  </Text>
                )}
              </View>
            )}
            {stream.status === 'ended' && (
              <View style={styles.scheduledOverlay}>
                <Text style={styles.scheduledText}>Stream has ended</Text>
              </View>
            )}
            {isPremiumLocked && (
              <View style={styles.scheduledOverlay}>
                <Lock size={32} color={Colors.primary} />
                <Text style={styles.scheduledText}>Premium Content</Text>
                <Text style={styles.scheduledTime}>Upgrade to watch this stream</Text>
              </View>
            )}
          </View>
        )}

        {/* LIVE Badge */}
        {stream.status === 'live' && (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
        )}

        {/* Viewer Count */}
        {stream.status === 'live' && (
          <View style={styles.viewerBadge}>
            <Eye size={14} color="#fff" />
            <Text style={styles.viewerText}>{formatViewerCount(stream.viewer_count)} watching</Text>
          </View>
        )}

        {/* Duration */}
        {stream.status === 'live' && stream.started_at && (
          <View style={styles.durationBadge}>
            <Text style={styles.durationText}>{duration}</Text>
          </View>
        )}

        {/* Back Button */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stream Info + Chat */}
      <View style={styles.contentContainer}>
        <ScrollView style={styles.infoSection} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.duration(300)}>
            <Text style={styles.streamTitle}>{stream.title}</Text>

            <View style={styles.creatorRow}>
              <View style={styles.creatorAvatar}>
                <Text style={styles.creatorAvatarText}>
                  {(stream.creator_name || 'U')[0].toUpperCase()}
                </Text>
              </View>
              <View style={styles.creatorInfo}>
                <View style={styles.creatorNameRow}>
                  <Text style={styles.creatorName}>{stream.creator_name || 'Unknown'}</Text>
                  {stream.subscriber_count !== undefined && (
                    <Text style={styles.subCount}>
                      {formatViewerCount(stream.subscriber_count)} subscribers
                    </Text>
                  )}
                </View>
              </View>
              {!isCreator && (
                <TouchableOpacity
                  style={[styles.subscribeBtn, isSubscriber && styles.subscribedBtn]}
                  onPress={() => router.push(`/channel?creatorId=${stream.creator_id}`)}
                >
                  <Text style={[styles.subscribeText, isSubscriber && styles.subscribedText]}>
                    {isSubscriber ? 'Subscribed' : 'Subscribe'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {stream.description ? (
              <Text style={styles.streamDescription}>{stream.description}</Text>
            ) : null}

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={handleShare}>
                <Share2 size={18} color={Colors.text.primary} />
                <Text style={styles.actionText}>Share</Text>
              </TouchableOpacity>
              {stream.is_premium && (
                <View style={styles.premiumBadge}>
                  <Crown size={14} color="#FFD700" />
                  <Text style={styles.premiumText}>Premium</Text>
                </View>
              )}
              {stream.is_member_only && (
                <View style={styles.memberBadge}>
                  <Lock size={14} color={Colors.status.info} />
                  <Text style={styles.memberText}>Members Only</Text>
                </View>
              )}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Live Chat */}
        <View style={styles.chatSection}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Live Chat</Text>
            {stream.status === 'live' && (
              <View style={styles.chatLiveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.chatLiveText}>Live</Text>
              </View>
            )}
          </View>
          <LiveChat
            stream={stream}
            isCreator={isCreator}
            isAdmin={isAdmin}
            isSubscriber={isSubscriber}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { color: Colors.text.muted, fontSize: FontSizes.md },
  backBtn: { marginTop: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md },
  backBtnText: { color: Colors.text.primary, fontSize: FontSizes.sm },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: VIDEO_HEIGHT,
    backgroundColor: '#000',
    position: 'relative',
  },
  placeholderVideo: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.card },
  thumbnail: { width: '100%', height: '100%', position: 'absolute' },
  overlayGradient: { width: '100%', height: '100%', position: 'absolute', backgroundColor: 'rgba(0,0,0,0.5)' },
  scheduledOverlay: { alignItems: 'center', gap: Spacing.sm },
  scheduledText: { color: '#fff', fontSize: FontSizes.lg, fontWeight: FontWeights.bold },
  scheduledTime: { color: Colors.text.muted, fontSize: FontSizes.sm },
  liveBadge: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
  viewerBadge: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  viewerText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: FontWeights.medium },
  durationBadge: {
    position: 'absolute',
    bottom: Spacing.md,
    right: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  durationText: { color: '#fff', fontSize: FontSizes.xs, fontWeight: FontWeights.medium },
  backBtnOverlay: {
    position: 'absolute',
    top: Spacing.md,
    left: 0,
    padding: Spacing.md,
  },
  contentContainer: { flex: 1, flexDirection: 'row' },
  infoSection: { flex: 1, padding: Spacing.lg },
  streamTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.md },
  creatorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.md },
  creatorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.secondary, justifyContent: 'center', alignItems: 'center' },
  creatorAvatarText: { fontSize: FontSizes.md, fontWeight: FontWeights.bold, color: Colors.text.primary },
  creatorInfo: { flex: 1 },
  creatorNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  creatorName: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  subCount: { fontSize: FontSizes.xs, color: Colors.text.muted },
  subscribeBtn: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  subscribedBtn: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  subscribeText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.semibold },
  subscribedText: { color: Colors.text.muted },
  streamDescription: { fontSize: FontSizes.sm, color: Colors.text.secondary, lineHeight: 20, marginBottom: Spacing.md },
  actionRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginBottom: Spacing.lg },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.card, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  actionText: { color: Colors.text.primary, fontSize: FontSizes.sm, fontWeight: FontWeights.medium },
  premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  premiumText: { color: '#FFD700', fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  memberBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(6, 182, 212, 0.15)', paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm },
  memberText: { color: Colors.status.info, fontSize: FontSizes.xs, fontWeight: FontWeights.semibold },
  chatSection: { width: 380, maxWidth: '40%', borderLeftWidth: 1, borderLeftColor: Colors.border, backgroundColor: Colors.background },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  chatTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.bold, color: Colors.text.primary },
  chatLiveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chatLiveText: { color: Colors.primary, fontSize: FontSizes.xs, fontWeight: FontWeights.bold },
});
