import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft, Download, Trash2, HardDrive, Clock, CheckCircle,
  AlertCircle, Loader, Film,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, FontSizes, FontWeights } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import {
  getUserDownloads,
  removeDownload,
  removeAllDownloads,
  getDownloadStorageUsage,
  formatFileSize,
  DOWNLOAD_QUALITIES,
} from '../lib/downloads';
import { getPlatformSettings } from '../lib/monetization';
import type { Download as DownloadType, Video } from '../lib/supabase';
import { CachedImage } from '../components/CachedImage';

type DownloadWithVideo = DownloadType & { video?: Video };

export default function DownloadsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [downloads, setDownloads] = useState<DownloadWithVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageUsed, setStorageUsed] = useState(0);
  const [downloadsEnabled, setDownloadsEnabled] = useState(true);

  const loadDownloads = useCallback(async () => {
    if (!user) return;
    try {
      const [items, storage] = await Promise.all([
        getUserDownloads(user.id),
        getDownloadStorageUsage(user.id),
      ]);
      setDownloads(items);
      setStorageUsed(storage);
    } catch (e) {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadDownloads();
    getPlatformSettings()
      .then((s) => setDownloadsEnabled(s?.downloads_enabled ?? true))
      .catch(() => {});
  }, [loadDownloads]);

  const handleRemove = (downloadId: string, title: string) => {
    Alert.alert('Remove Download', `Remove "${title}" from your downloads?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeDownload(downloadId);
          loadDownloads();
        },
      },
    ]);
  };

  const handleClearAll = () => {
    if (downloads.length === 0) return;
    Alert.alert('Clear All Downloads', 'Remove all downloaded videos? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          if (!user) return;
          await removeAllDownloads(user.id);
          loadDownloads();
        },
      },
    ]);
  };

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} color={Colors.status.success} />;
      case 'downloading': return <Loader size={16} color={Colors.status.info} />;
      case 'failed': return <AlertCircle size={16} color={Colors.status.error} />;
      case 'pending': return <Clock size={16} color={Colors.text.muted} />;
      default: return <Clock size={16} color={Colors.text.muted} />;
    }
  };

  const STORAGE_LIMIT = 5 * 1024 * 1024 * 1024;
  const storagePercent = Math.min(100, (storageUsed / STORAGE_LIMIT) * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backIcon}>
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Downloads</Text>
        {downloads.length > 0 && (
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <Trash2 size={18} color={Colors.status.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Storage Usage */}
      <View style={styles.storageCard}>
        <View style={styles.storageHeader}>
          <HardDrive size={18} color={Colors.primary} />
          <Text style={styles.storageTitle}>Storage</Text>
        </View>
        <View style={styles.storageBar}>
          <View style={[styles.storageBarFill, { width: `${storagePercent}%` }]} />
        </View>
        <Text style={styles.storageText}>
          {formatFileSize(storageUsed)} of {formatFileSize(STORAGE_LIMIT)} used
        </Text>
      </View>

      {loading ? (
        <View style={styles.emptyState}>
          <Loader size={32} color={Colors.text.muted} />
          <Text style={styles.emptyText}>Loading downloads...</Text>
        </View>
      ) : downloads.length === 0 ? (
        <View style={styles.emptyState}>
          <Download size={48} color={Colors.text.muted} />
          <Text style={styles.emptyText}>No downloads yet</Text>
          <Text style={styles.emptySubtext}>Download videos to watch offline</Text>
          <TouchableOpacity style={styles.browseBtn} onPress={() => router.push('/(tabs)')}>
            <Text style={styles.browseBtnText}>Browse Videos</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={downloads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(200)}>
              <View style={styles.downloadCard}>
                <TouchableOpacity
                  style={styles.cardContent}
                  onPress={() => item.video && router.push(`/player/${item.video_id}`)}
                >
                  <View style={styles.thumbnailContainer}>
                    <CachedImage uri={item.video?.thumbnail_url || ''} style={styles.thumbnail} />
                    <View style={styles.durationBadge}>
                      <Text style={styles.durationText}>
                        {item.video ? formatDuration(item.video.duration) : ''}
                      </Text>
                    </View>
                    {item.status === 'completed' && (
                      <View style={styles.downloadedBadge}>
                        <Download size={12} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle} numberOfLines={2}>
                      {item.video?.title || 'Unknown Video'}
                    </Text>
                    <View style={styles.cardMeta}>
                      {getStatusIcon(item.status)}
                      <Text style={styles.cardMetaText}>
                        {item.status === 'completed' ? 'Downloaded' :
                         item.status === 'downloading' ? 'Downloading...' :
                         item.status === 'failed' ? 'Failed' :
                         'Pending'}
                      </Text>
                      {item.quality !== 'auto' && (
                        <Text style={styles.qualityBadge}>{item.quality}p</Text>
                      )}
                      {item.file_size > 0 && (
                        <Text style={styles.fileSize}>{formatFileSize(item.file_size)}</Text>
                      )}
                    </View>
                    {item.downloaded_at && (
                      <Text style={styles.downloadDate}>
                        Downloaded {new Date(item.downloaded_at).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemove(item.id, item.video?.title || 'Video')}
                >
                  <Trash2 size={18} color={Colors.status.error} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, paddingTop: Spacing.xl },
  backIcon: { padding: Spacing.sm },
  headerTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, flex: 1, marginLeft: Spacing.sm },
  clearBtn: { padding: Spacing.sm },
  storageCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md },
  storageHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  storageTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  storageBar: { height: 6, backgroundColor: Colors.secondary, borderRadius: 3, overflow: 'hidden', marginBottom: Spacing.xs },
  storageBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 3 },
  storageText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Spacing.sm, paddingBottom: Spacing.xxl },
  emptyText: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.text.primary },
  emptySubtext: { fontSize: FontSizes.sm, color: Colors.text.muted },
  browseBtn: { marginTop: Spacing.sm, backgroundColor: Colors.primary, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.lg },
  browseBtnText: { color: '#fff', fontSize: FontSizes.sm, fontWeight: FontWeights.semibold },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  downloadCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  cardContent: { flex: 1, flexDirection: 'row' },
  thumbnailContainer: { width: 120, height: 68, backgroundColor: Colors.secondary, position: 'relative' },
  thumbnail: { width: '100%', height: '100%' },
  durationBadge: { position: 'absolute', bottom: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 2 },
  durationText: { color: '#fff', fontSize: 10 },
  downloadedBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: Colors.status.success, width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardInfo: { flex: 1, padding: Spacing.sm },
  cardTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 4 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardMetaText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  qualityBadge: { fontSize: 10, fontWeight: FontWeights.bold, color: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.1)', paddingHorizontal: 4, borderRadius: 2 },
  fileSize: { fontSize: FontSizes.xs, color: Colors.text.muted },
  downloadDate: { fontSize: FontSizes.xs, color: Colors.text.muted },
  removeBtn: { padding: Spacing.md },
});
