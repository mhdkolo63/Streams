import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  User,
  Heart,
  Clock,
  Film,
  Lock,
  LogOut,
  ChevronRight,
  Shield,
  Bell,
  HelpCircle,
  Settings,
  Star,
  Eye,
  Calendar,
  Play,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/Button';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { ProfileSkeleton } from '@/components/Skeleton';

const { width } = Dimensions.get('window');

export default function ProfileScreen() {
  const router = useRouter();
  const { user, profile, isAdmin, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    watched: 0,
    favorites: 0,
    watchTime: 0,
    watchlist: 0,
    notifications: 0,
    completed: 0,
  });
  const [unreadCount, setUnreadCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  const fetchStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const [
        watchedCount,
        favCount,
        historyData,
        unreadNotifications,
        likesCount,
        completedCount,
      ] = await Promise.all([
        supabase.from('watch_history').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('favorites').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('watch_history').select('progress').eq('user_id', user.id),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false),
        supabase.from('video_likes').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('watch_history').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('completed', true),
      ]);

      const totalSeconds = (historyData.data || []).reduce((sum, item) => sum + (item.progress || 0), 0);
      const watchTimeHours = Math.floor(totalSeconds / 3600);

      setStats({
        watched: watchedCount.count || 0,
        favorites: favCount.count || 0,
        watchTime: watchTimeHours,
        watchlist: likesCount.count || 0,
        notifications: unreadNotifications.count || 0,
        completed: completedCount.count || 0,
      });

      setUnreadCount(unreadNotifications.count || 0);

      // Fetch recent activity
      const { data: recentHistory } = await supabase
        .from('watch_history')
        .select('last_watched_at, videos(title, id, thumbnail_url)')
        .eq('user_id', user.id)
        .order('last_watched_at', { ascending: false })
        .limit(3);

      if (recentHistory && recentHistory.length > 0) {
        setRecentActivity(recentHistory.map((h: any) => ({
          type: 'watch',
          title: h.videos?.title || 'Unknown video',
          videoId: h.videos?.id,
          thumbnail: h.videos?.thumbnail_url,
          timestamp: h.last_watched_at,
        })));
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Real-time notification count
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('profile-notifications')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => fetchStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'favorites', filter: `user_id=eq.${user.id}` }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  }, [fetchStats]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
              router.replace('/');
            } catch (error) {
              console.error('Sign out error:', error);
              setSigningOut(false);
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (!user) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
        </View>
        <View style={styles.guestContainer}>
          <Animated.View entering={FadeInUp.duration(400)}>
            <View style={styles.guestAvatar}>
              <User size={48} color={Colors.text.muted} />
            </View>
          </Animated.View>
          <Text style={styles.guestTitle}>Welcome to StreamFlix</Text>
          <Text style={styles.guestSubtitle}>
            Sign in to access your profile, favorites, and watch history
          </Text>
          <Button title="Sign In" onPress={() => router.push('/auth/login')} style={styles.authButton} />
          <Button title="Create Account" onPress={() => router.push('/auth/register')} variant="outline" style={styles.authButton} />
          <Button
            title="Sign in as Admin"
            onPress={() => router.push('/admin/login')}
            variant="outline"
            icon={<Shield size={18} color={Colors.primary} />}
            style={styles.adminLoginButton}
          />
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ProfileSkeleton />
      </View>
    );
  }

  const statItems = [
    { icon: Film, label: 'Watched', value: stats.watched.toString(), color: Colors.status.info },
    { icon: Heart, label: 'Favorites', value: stats.favorites.toString(), color: Colors.primary },
    { icon: Clock, label: 'Watch Time', value: `${stats.watchTime}h`, color: Colors.status.success },
    { icon: Star, label: 'Liked', value: stats.watchlist.toString(), color: Colors.status.warning },
  ];

  const menuSections = [
    {
      title: 'Account',
      items: [
        { icon: User, label: 'Edit Profile', onPress: () => router.push('/profile/edit') },
        { icon: Lock, label: 'Change Password', onPress: () => router.push('/auth/change-password') },
        { icon: Bell, label: 'Notifications', badge: unreadCount, onPress: () => router.push('/notifications') },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: HelpCircle, label: 'Help Center', onPress: () => router.push('/help') },
        { icon: Shield, label: 'Privacy Policy', onPress: () => router.push('/privacy') },
      ],
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      {/* Profile Card */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.profileCard}>
        <View style={styles.avatarContainer}>
          {profile?.avatar_url ? (
            <Image source={{ uri: profile.avatar_url, cache: 'reload' }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <User size={32} color={Colors.text.primary} />
            </View>
          )}
          <TouchableOpacity style={styles.avatarEditButton} onPress={() => router.push('/profile/edit')}>
            <Settings size={16} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.userName}>{profile?.full_name || 'User'}</Text>
          <Text style={styles.userEmail}>{profile?.email}</Text>
          {profile?.username && <Text style={styles.userUsername}>@{profile.username}</Text>}
          {isAdmin && (
            <View style={styles.adminBadge}>
              <Shield size={12} color={Colors.text.primary} />
              <Text style={styles.adminText}>Admin</Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Admin Card */}
      {isAdmin && (
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <TouchableOpacity style={styles.adminCard} onPress={() => router.push('/admin')} activeOpacity={0.8}>
            <View style={styles.adminCardIcon}>
              <Shield size={20} color={Colors.primary} />
            </View>
            <View style={styles.adminCardContent}>
              <Text style={styles.adminCardTitle}>Admin Dashboard</Text>
              <Text style={styles.adminCardSubtitle}>Manage videos, users, and analytics</Text>
            </View>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Stats Grid */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.statsContainer}>
        {statItems.map((stat, index) => (
          <Animated.View entering={FadeInDown.delay(200 + index * 50).duration(300)} key={index} style={styles.statItem}>
            <View style={[styles.statIcon, { backgroundColor: `${stat.color}15` }]}>
              <stat.icon size={18} color={stat.color} />
            </View>
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </Animated.View>
        ))}
      </Animated.View>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/history')}>
              <Text style={styles.seeAllText}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentActivity.map((activity, index) => (
            <TouchableOpacity
              key={index}
              style={styles.activityItem}
              onPress={() => activity.videoId && router.push(`/video/${activity.videoId}`)}
              activeOpacity={0.7}
            >
              <View style={styles.activityIcon}>
                <Play size={14} color={Colors.primary} />
              </View>
              <View style={styles.activityContent}>
                <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
                <Text style={styles.activityTime}>{formatTimeAgo(activity.timestamp)}</Text>
              </View>
              <ChevronRight size={16} color={Colors.text.muted} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}

      {/* Menu Sections */}
      {menuSections.map((section, sectionIndex) => (
        <Animated.View entering={FadeInDown.delay(300 + sectionIndex * 50).duration(400)} key={sectionIndex} style={styles.menuSection}>
          <Text style={styles.menuSectionTitle}>{section.title}</Text>
          <View style={styles.menuCard}>
            {section.items.map((item: any, itemIndex: number) => (
              <TouchableOpacity
                key={itemIndex}
                style={[styles.menuItem, itemIndex < section.items.length - 1 && styles.menuItemBorder]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <item.icon size={20} color={Colors.text.secondary} />
                  <Text style={styles.menuItemLabel}>{item.label}</Text>
                  {item.badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </View>
                <ChevronRight size={20} color={Colors.text.muted} />
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      ))}

      {/* Admin Sign In (for non-admins) */}
      {!isAdmin && (
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <TouchableOpacity style={styles.adminSignInButton} onPress={() => router.push('/admin/login')} activeOpacity={0.7}>
            <Shield size={20} color={Colors.primary} />
            <Text style={styles.adminSignInText}>Sign in as Admin</Text>
            <ChevronRight size={20} color={Colors.text.muted} />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Sign Out */}
      <Animated.View entering={FadeInDown.delay(450).duration(400)}>
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} disabled={signingOut} activeOpacity={0.7}>
          <LogOut size={20} color={Colors.status.error} />
          <Text style={styles.signOutText}>{signingOut ? 'Signing out...' : 'Sign Out'}</Text>
        </TouchableOpacity>
      </Animated.View>

      <Text style={styles.version}>StreamFlix v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  title: { fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  guestContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl },
  guestAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  guestTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.sm },
  guestSubtitle: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  authButton: { width: '100%', marginBottom: Spacing.sm },
  adminLoginButton: { width: '100%', marginTop: Spacing.md, borderColor: Colors.primary },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarContainer: { position: 'relative', marginRight: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36 },
  avatarPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarEditButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  profileInfo: { flex: 1 },
  userName: { fontSize: FontSizes.xl, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.xs },
  userEmail: { fontSize: FontSizes.md, color: Colors.text.secondary, marginBottom: 2 },
  userUsername: { fontSize: FontSizes.sm, color: Colors.text.muted },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.sm, gap: 4, alignSelf: 'flex-start', marginTop: Spacing.xs },
  adminText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  adminCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, gap: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  adminCardIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: 'rgba(229, 9, 20, 0.1)', justifyContent: 'center', alignItems: 'center' },
  adminCardContent: { flex: 1 },
  adminCardTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  adminCardSubtitle: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: 2 },
  statsContainer: { flexDirection: 'row', paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg, gap: Spacing.sm },
  statItem: { flex: 1, alignItems: 'center', backgroundColor: Colors.card, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border },
  statIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs },
  statValue: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  statLabel: { fontSize: FontSizes.xs, color: Colors.text.secondary, marginTop: 2 },
  activitySection: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  seeAllText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  activityItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, gap: Spacing.md },
  activityIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(229, 9, 20, 0.1)', justifyContent: 'center', alignItems: 'center' },
  activityContent: { flex: 1 },
  activityTitle: { fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  activityTime: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  menuSection: { marginBottom: Spacing.lg },
  menuSectionTitle: { fontSize: FontSizes.sm, fontWeight: FontWeights.medium, color: Colors.text.muted, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 0.5 },
  menuCard: { backgroundColor: Colors.card, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.lg, overflow: 'hidden', borderWidth: 1, borderColor: Colors.border },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.md },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  menuItemLabel: { fontSize: FontSizes.md, color: Colors.text.primary },
  badge: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full, minWidth: 20, alignItems: 'center' },
  badgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.primary },
  adminSignInButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: Colors.primary },
  adminSignInText: { flex: 1, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.primary },
  signOutButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.card, marginHorizontal: Spacing.lg, marginVertical: Spacing.lg, padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.sm, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' },
  signOutText: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.status.error },
  version: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center', marginBottom: Spacing.xxl },
});
