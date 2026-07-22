import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Bell,
  Users,
  MessageSquare,
  ThumbsUp,
  Share2,
  Heart,
  Flag,
  Info,
  MoreVertical,
  Trash2,
  CheckCheck,
  Clock,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, SlideOutRight, Layout } from 'react-native-reanimated';
import { supabase, Notification } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

type Category = 'all' | 'subscribers' | 'comments' | 'likes' | 'shares' | 'reports' | 'admin';

export default function StudioNotificationsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Category>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications(data || []);
      const unread = (data || []).filter((n) => !n.is_read).length;
      setUnreadCount(unread);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const getCategory = (notif: Notification): Category => {
    const type = (notif as any).type || (notif as any).notification_type || '';
    if (type.includes('subscribe')) return 'subscribers';
    if (type.includes('comment') || type.includes('reply')) return 'comments';
    if (type.includes('like')) return 'likes';
    if (type.includes('share')) return 'shares';
    if (type.includes('report')) return 'reports';
    if (type.includes('admin')) return 'admin';
    return 'all';
  };

  const getCategoryIcon = (notif: Notification) => {
    const cat = getCategory(notif);
    switch (cat) {
      case 'subscribers': return <Users size={20} color="#EC4899" />;
      case 'comments': return <MessageSquare size={20} color="#8B5CF6" />;
      case 'likes': return <ThumbsUp size={20} color="#F59E0B" />;
      case 'shares': return <Share2 size={20} color="#F97316" />;
      case 'reports': return <Flag size={20} color={Colors.status.error} />;
      case 'admin': return <Info size={20} color={Colors.status.info} />;
      default: return <Bell size={20} color={Colors.text.muted} />;
    }
  };

  const filtered = filter === 'all' ? notifications : notifications.filter((n) => getCategory(n) === filter);

  const handleMarkAllRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('notifications').delete().eq('id', id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.info('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handlePress = (notif: Notification) => {
    if (!notif.is_read) {
      supabase.from('notifications').update({ is_read: true }).eq('id', notif.id).then(() => {
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n)));
        setUnreadCount((prev) => Math.max(0, prev - 1));
      });
    }
    if (notif.video_id) router.push(`/player/${notif.video_id}`);
  };

  const formatTimeAgo = (dateString: string): string => {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const categories: { key: Category; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'subscribers', label: 'Subscribers' },
    { key: 'comments', label: 'Comments' },
    { key: 'likes', label: 'Likes' },
    { key: 'shares', label: 'Shares' },
    { key: 'reports', label: 'Reports' },
    { key: 'admin', label: 'Admin' },
  ];

  const renderItem = ({ item, index }: { item: Notification; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 30).duration(200)}
      layout={Layout.springify()}
      exiting={SlideOutRight.duration(200)}
    >
      <TouchableOpacity
        style={[styles.notifCard, !item.is_read && styles.unreadCard]}
        onPress={() => handlePress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.notifIconWrap}>{getCategoryIcon(item)}</View>
        <View style={styles.notifContent}>
          <Text style={styles.notifTitle} numberOfLines={2}>{item.title || 'New notification'}</Text>
          {item.body && <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>}
          <View style={styles.notifMeta}>
            <Clock size={11} color={Colors.text.muted} />
            <Text style={styles.notifTime}>{formatTimeAgo(item.created_at)}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Trash2 size={16} color={Colors.text.muted} />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
            </View>
          )}
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllBtn} onPress={handleMarkAllRead}>
              <CheckCheck size={18} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>

        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.filterTab, filter === item.key && styles.filterTabActive]}
              onPress={() => setFilter(item.key)}
            >
              <Text style={[styles.filterTabText, filter === item.key && styles.filterTabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />

        {!loading && unreadCount > 0 && (
          <TouchableOpacity style={styles.markAllBar} onPress={handleMarkAllRead}>
            <CheckCheck size={14} color={Colors.primary} />
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        )}

        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <EmptyState
            type="custom"
            icon={<Bell size={64} color={Colors.text.muted} />}
            title="No notifications"
            message="Creator notifications will appear here when viewers interact with your content."
          />
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xs, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  unreadBadge: { backgroundColor: Colors.primary, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, justifyContent: 'center', alignItems: 'center' },
  unreadBadgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: '#fff' },
  markAllBtn: { padding: Spacing.xs },
  filterTabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: Spacing.sm },
  filterTab: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.card },
  filterTabActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  filterTabText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  filterTabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  markAllBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  markAllText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  notifCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  unreadCard: { backgroundColor: 'rgba(229, 9, 20, 0.05)', borderColor: 'rgba(229, 9, 20, 0.2)' },
  notifIconWrap: { width: 40, alignItems: 'center', justifyContent: 'center' },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: 2 },
  notifBody: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginBottom: 4 },
  notifMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  notifTime: { fontSize: FontSizes.xs, color: Colors.text.muted },
  deleteBtn: { padding: Spacing.xs, justifyContent: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: FontSizes.md, color: Colors.text.muted },
});
