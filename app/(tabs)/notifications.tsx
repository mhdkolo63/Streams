import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  Alert,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  CheckCheck,
  Trash2,
  Clock,
  Video as VideoIcon,
  MoreVertical,
  Heart,
  MessageSquare,
  UserPlus,
  Users,
  Settings as SettingsIcon,
  Info,
  Filter,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, Layout, SlideOutRight } from 'react-native-reanimated';
import { supabase, Notification } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { EmptyState } from '@/components/EmptyState';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width } = Dimensions.get('window');

type NotificationCategory = 'all' | 'uploads' | 'comments' | 'replies' | 'likes' | 'subscribers' | 'community' | 'system';

const categoryConfig: Record<NotificationCategory, { label: string; icon: typeof Bell }> = {
  all: { label: 'All', icon: Filter },
  uploads: { label: 'Uploads', icon: VideoIcon },
  comments: { label: 'Comments', icon: MessageSquare },
  replies: { label: 'Replies', icon: MessageSquare },
  likes: { label: 'Likes', icon: Heart },
  subscribers: { label: 'Subscribers', icon: UserPlus },
  community: { label: 'Community', icon: Users },
  system: { label: 'System', icon: Info },
};

function getNotificationCategory(notif: Notification): NotificationCategory {
  const type = (notif as any).type || (notif as any).notification_type || '';
  if (type.includes('upload') || type.includes('video')) return 'uploads';
  if (type.includes('reply')) return 'replies';
  if (type.includes('comment')) return 'comments';
  if (type.includes('like')) return 'likes';
  if (type.includes('subscribe') || type.includes('subscriber')) return 'subscribers';
  if (type.includes('community') || type.includes('post')) return 'community';
  return 'system';
}

export default function NotificationsTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState<NotificationCategory>('all');

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
        .order('created_at', { ascending: false });

      if (error) throw error;

      setNotifications(data || []);

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications', 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-tab-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchNotifications())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchNotifications]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNotifications();
    setRefreshing(false);
  }, [fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
      setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      toast.error('Failed to mark as read', 'Please try again');
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read');
    } catch (error) {
      toast.error('Failed to mark all as read', 'Please try again');
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      const notification = notifications.find(n => n.id === notificationId);
      await supabase.from('notifications').delete().eq('id', notificationId);
      setNotifications(prev => prev.filter(n => n.id !== notificationId));
      if (notification && !notification.is_read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      toast.info('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete', 'Please try again');
    }
  };

  const clearAll = async () => {
    if (!user) return;
    Alert.alert('Clear All', 'Delete all notifications?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear All',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('notifications').delete().eq('user_id', user.id);
            setNotifications([]);
            setUnreadCount(0);
            toast.success('All notifications cleared');
          } catch (error) {
            toast.error('Failed to clear notifications', 'Please try again');
          }
        },
      },
    ]);
  };

  const handleNotificationPress = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.video_id) {
      router.push(`/player/${notification.video_id}`);
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filteredNotifications = useMemo(() => {
    if (filter === 'all') return notifications;
    return notifications.filter(n => getNotificationCategory(n) === filter);
  }, [notifications, filter]);

  const categoryCounts = useMemo(() => {
    const counts: Partial<Record<NotificationCategory, number>> = {};
    notifications.forEach(n => {
      const cat = getNotificationCategory(n);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  const getCategoryIcon = (notif: Notification) => {
    const cat = getNotificationCategory(notif);
    switch (cat) {
      case 'uploads': return <VideoIcon size={20} color={Colors.primary} />;
      case 'comments':
      case 'replies': return <MessageSquare size={20} color={Colors.status.info} />;
      case 'likes': return <Heart size={20} color={Colors.status.error} />;
      case 'subscribers': return <UserPlus size={20} color={Colors.status.success} />;
      case 'community': return <Users size={20} color={Colors.status.warning} />;
      default: return <Info size={20} color={Colors.text.muted} />;
    }
  };

  const renderNotification = ({ item, index }: { item: Notification; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 30).duration(300)}
      layout={Layout.springify()}
      exiting={SlideOutRight.duration(200)}
    >
      <TouchableOpacity
        style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.thumbnailContainer}>
          {getCategoryIcon(item)}
          {!item.is_read && <View style={styles.unreadDot} />}
        </View>

        <View style={styles.notificationContent}>
          <Text style={styles.notificationTitle} numberOfLines={2}>{item.title || 'New notification'}</Text>
          {item.body && <Text style={styles.notificationBody} numberOfLines={2}>{item.body}</Text>}
          <View style={styles.notificationMeta}>
            <Clock size={12} color={Colors.text.muted} />
            <Text style={styles.notificationTime}>{formatTimeAgo(item.created_at)}</Text>
          </View>
        </View>

        <View style={styles.notificationActions}>
          {!item.is_read && (
            <TouchableOpacity style={styles.actionIcon} onPress={() => markAsRead(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <CheckCheck size={18} color={Colors.status.success} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionIcon} onPress={() => deleteNotification(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Trash2 size={18} color={Colors.text.muted} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  const categoryKeys = Object.keys(categoryConfig) as NotificationCategory[];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Bell size={20} color={Colors.text.primary} />
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
        </View>
        {notifications.length > 0 && (
          <TouchableOpacity
            style={styles.optionsButton}
            onPress={() => Alert.alert('Notification Options', undefined, [
              unreadCount > 0 ? { text: 'Mark All as Read', onPress: markAllAsRead } : undefined,
              { text: 'Clear All Notifications', onPress: clearAll, style: 'destructive' },
              { text: 'Cancel', style: 'cancel' },
            ].filter(Boolean) as any[])}
          >
            <MoreVertical size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Category Filter Chips */}
      {notifications.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterTabs}
        >
          {categoryKeys.map((cat) => {
            const config = categoryConfig[cat];
            const count = cat === 'all' ? notifications.length : categoryCounts[cat] || 0;
            if (cat !== 'all' && count === 0) return null;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.filterTab, filter === cat && styles.filterTabActive]}
                onPress={() => setFilter(cat)}
              >
                <config.icon size={14} color={filter === cat ? Colors.primary : Colors.text.secondary} />
                <Text style={[styles.filterTabText, filter === cat && styles.filterTabTextActive]}>
                  {config.label}
                </Text>
                {count > 0 && cat !== 'all' && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {notifications.length > 0 && unreadCount > 0 && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.quickActions}>
          <TouchableOpacity style={styles.markAllButton} onPress={markAllAsRead}>
            <CheckCheck size={16} color={Colors.primary} />
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {!user ? (
        <EmptyState
          type="custom"
          icon={<Bell size={64} color={Colors.text.muted} />}
          title="Sign in required"
          message="Sign in to see your notifications when new videos are uploaded."
          onAction={() => router.push('/auth/login')}
          actionLabel="Sign In"
        />
      ) : loading ? (
        <View style={styles.loadingContainer}>
          {[1, 2, 3].map((i) => (
            <Animated.View entering={FadeIn.delay(i * 100).duration(300)} key={i} style={styles.skeletonItem}>
              <View style={styles.skeletonThumbnail} />
              <View style={styles.skeletonContent}>
                <View style={styles.skeletonTitle} />
                <View style={styles.skeletonMeta} />
              </View>
            </Animated.View>
          ))}
        </View>
      ) : filteredNotifications.length === 0 ? (
        <EmptyState
          type="notifications"
          icon={<Bell size={64} color={Colors.text.muted} />}
          title={filter !== 'all' ? `No ${categoryConfig[filter].label.toLowerCase()} notifications` : 'No notifications yet'}
          message={filter !== 'all' ? "Nothing in this category." : "We'll notify you when new videos are uploaded."}
        />
      ) : (
        <FlatList
          data={filteredNotifications}
          keyExtractor={(item) => item.id}
          renderItem={renderNotification}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} colors={[Colors.primary]} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, paddingTop: 60 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  unreadBadge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, minWidth: 22, alignItems: 'center', marginLeft: Spacing.xs },
  unreadBadgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.primary },
  optionsButton: { padding: Spacing.sm },
  filterTabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.md, gap: Spacing.sm },
  filterTab: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.full, backgroundColor: Colors.card, gap: 6 },
  filterTabActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  filterTabText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  filterTabTextActive: { color: Colors.primary },
  filterBadge: { backgroundColor: Colors.tertiary, paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: BorderRadius.full, minWidth: 18, alignItems: 'center' },
  filterBadgeText: { fontSize: 10, fontWeight: FontWeights.bold, color: Colors.text.secondary },
  quickActions: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  markAllButton: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: 'rgba(229, 9, 20, 0.1)', borderRadius: BorderRadius.md, alignSelf: 'flex-start' },
  markAllText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  notificationItem: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  unreadItem: { backgroundColor: 'rgba(229, 9, 20, 0.05)', borderColor: 'rgba(229, 9, 20, 0.2)' },
  thumbnailContainer: { position: 'relative', width: 40, alignItems: 'center', justifyContent: 'center' },
  unreadDot: { position: 'absolute', top: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.primary, borderWidth: 2, borderColor: Colors.background },
  notificationContent: { flex: 1, justifyContent: 'center' },
  notificationTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs, lineHeight: 20 },
  notificationBody: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginBottom: Spacing.xs, lineHeight: 18 },
  notificationMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  notificationTime: { fontSize: FontSizes.xs, color: Colors.text.muted },
  notificationActions: { justifyContent: 'center', alignItems: 'center', gap: Spacing.sm },
  actionIcon: { padding: Spacing.xs },
  loadingContainer: { padding: Spacing.lg },
  skeletonItem: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, gap: Spacing.md },
  skeletonThumbnail: { width: 40, height: 40, borderRadius: BorderRadius.full, backgroundColor: Colors.tertiary },
  skeletonContent: { flex: 1, gap: Spacing.sm },
  skeletonTitle: { width: '80%', height: 16, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  skeletonMeta: { width: '50%', height: 12, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
});
