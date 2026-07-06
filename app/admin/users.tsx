import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Image, TextInput,
  RefreshControl, Modal, ScrollView, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Search, X, Shield, Crown, UserX, UserCheck, Trash2, Eye, Clock,
  ChevronLeft, ChevronRight, AlertCircle, Mail, Phone, Calendar, Film,
  Heart, Users as UsersIcon, Activity, Lock,
} from 'lucide-react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const PAGE_SIZE = 10;

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  created_at: string;
  phone: string | null;
  username: string | null;
  status: string | null;
  last_login: string | null;
  watch_time: number | null;
}

export default function ManageUsersScreen() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const toast = useToast();

  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [detailModal, setDetailModal] = useState<UserProfile | null>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [userWatchHistory, setUserWatchHistory] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ type: 'suspend' | 'reactivate' | 'delete'; user: UserProfile } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ total: 0, active: 0, suspended: 0, admins: 0 });

  const fetchUsers = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const userProfiles = data as UserProfile[];
        setProfiles(userProfiles);
        setStats({
          total: userProfiles.length,
          active: userProfiles.filter(u => u.status !== 'suspended').length,
          suspended: userProfiles.filter(u => u.status === 'suspended').length,
          admins: userProfiles.filter(u => u.is_admin).length,
        });
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to load users', 'Please refresh the page');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) { router.replace('/admin/login'); return; }
    fetchUsers();
  }, [authLoading, user, isAdmin, router, fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(p =>
      p.email?.toLowerCase().includes(q) ||
      p.full_name?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q) ||
      p.phone?.toLowerCase().includes(q)
    );
  }, [profiles, searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setCurrentPage(1); }, [searchQuery]);

  const logAdminAction = async (action: string, description: string) => {
    if (!user) return;
    try { await supabase.from('admin_activity_logs').insert({ admin_id: user.id, action, description }); } catch {}
  };

  const openUserDetail = async (profile: UserProfile) => {
    setDetailModal(profile);
    setLoadingDetail(true);
    try {
      const [activityRes, historyRes] = await Promise.all([
        supabase.from('video_views').select('video_id, viewed_at, videos(title, thumbnail_url)').eq('user_id', profile.id).order('viewed_at', { ascending: false }).limit(20),
        supabase.from('watch_history').select('video_id, progress, completed, last_watched_at, videos(title, thumbnail_url, duration)').eq('user_id', profile.id).order('last_watched_at', { ascending: false }).limit(20),
      ]);
      setUserActivity(activityRes.data || []);
      setUserWatchHistory(historyRes.data || []);
    } catch (error) {
      console.error('Error fetching user detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmModal) return;
    setProcessing(true);
    try {
      const { type, user: targetUser } = confirmModal;
      if (type === 'suspend') {
        const { error } = await supabase.from('profiles').update({ status: 'suspended' }).eq('id', targetUser.id);
        if (error) throw error;
        setProfiles(prev => prev.map(p => p.id === targetUser.id ? { ...p, status: 'suspended' } : p));
        toast.success('User suspended', `${targetUser.full_name || targetUser.email} has been suspended`);
        await logAdminAction('suspend_user', `Suspended user: ${targetUser.email}`);
      } else if (type === 'reactivate') {
        const { error } = await supabase.from('profiles').update({ status: 'active' }).eq('id', targetUser.id);
        if (error) throw error;
        setProfiles(prev => prev.map(p => p.id === targetUser.id ? { ...p, status: 'active' } : p));
        toast.success('User reactivated', `${targetUser.full_name || targetUser.email} is now active`);
        await logAdminAction('reactivate_user', `Reactivated user: ${targetUser.email}`);
      } else if (type === 'delete') {
        await Promise.all([
          supabase.from('watch_history').delete().eq('user_id', targetUser.id),
          supabase.from('favorites').delete().eq('user_id', targetUser.id),
          supabase.from('video_likes').delete().eq('user_id', targetUser.id),
          supabase.from('video_views').delete().eq('user_id', targetUser.id),
          supabase.from('notifications').delete().eq('user_id', targetUser.id),
        ]);
        const { error } = await supabase.from('profiles').delete().eq('id', targetUser.id);
        if (error) throw error;
        setProfiles(prev => prev.filter(p => p.id !== targetUser.id));
        toast.success('User deleted', `${targetUser.full_name || targetUser.email} has been removed`);
        await logAdminAction('delete_user', `Deleted user: ${targetUser.email}`);
      }
      setConfirmModal(null);
      if (detailModal?.id === targetUser.id) setDetailModal(null);
    } catch (error) {
      console.error('Action failed:', error);
      toast.error('Action failed', 'Please try again');
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || loading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return <View style={styles.container}><View style={styles.unauthorized}><Text style={styles.unauthorizedText}>Access Denied</Text></View></View>;
  }

  const renderUserItem = ({ item, index }: { item: UserProfile; index: number }) => {
    const isSuspended = item.status === 'suspended';
    return (
      <Animated.View entering={FadeInDown.delay(index * 20).duration(200)} style={[styles.userCard, isSuspended && styles.userCardSuspended]}>
        <TouchableOpacity style={styles.userInfo} onPress={() => openUserDetail(item)} activeOpacity={0.8}>
          <View style={styles.avatarContainer}>
            {item.avatar_url ? <Image source={{ uri: item.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{(item.full_name || item.email || '?').charAt(0).toUpperCase()}</Text></View>}
            {item.is_admin && <View style={styles.adminBadge}><Crown size={10} color={Colors.text.primary} /></View>}
            {isSuspended && <View style={styles.suspendedBadge}><Lock size={10} color={Colors.text.primary} /></View>}
          </View>
          <View style={styles.userDetails}>
            <Text style={styles.userName}>{item.full_name || item.email?.split('@')[0] || 'Unknown'}</Text>
            <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
            <View style={styles.userMeta}>
              <Text style={styles.metaText}>{new Date(item.created_at).toLocaleDateString()}</Text>
              {item.is_admin && <View style={styles.adminTag}><Text style={styles.adminTagText}>ADMIN</Text></View>}
              {isSuspended && <View style={styles.suspendedTag}><Text style={styles.suspendedTagText}>SUSPENDED</Text></View>}
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.userActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openUserDetail(item)}><Eye size={18} color={Colors.text.muted} /></TouchableOpacity>
          {isSuspended ? (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSuccess]} onPress={() => setConfirmModal({ type: 'reactivate', user: item })}><UserCheck size={18} color={Colors.status.success} /></TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.actionBtn, styles.actionBtnWarning]} onPress={() => setConfirmModal({ type: 'suspend', user: item })}><UserX size={18} color={Colors.status.warning} /></TouchableOpacity>
          )}
          {!item.is_admin && <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => setConfirmModal({ type: 'delete', user: item })}><Trash2 size={18} color={Colors.status.error} /></TouchableOpacity>}
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}><UsersIcon size={16} color={Colors.status.info} /><Text style={styles.statValue}>{stats.total}</Text><Text style={styles.statLabel}>Total</Text></View>
        <View style={styles.statItem}><UserCheck size={16} color={Colors.status.success} /><Text style={styles.statValue}>{stats.active}</Text><Text style={styles.statLabel}>Active</Text></View>
        <View style={styles.statItem}><UserX size={16} color={Colors.status.warning} /><Text style={styles.statValue}>{stats.suspended}</Text><Text style={styles.statLabel}>Suspended</Text></View>
        <View style={styles.statItem}><Crown size={16} color={Colors.primary} /><Text style={styles.statValue}>{stats.admins}</Text><Text style={styles.statLabel}>Admins</Text></View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Search size={20} color={Colors.text.muted} />
        <TextInput style={styles.searchInput} placeholder="Search by name, email, username..." placeholderTextColor={Colors.text.muted} value={searchQuery} onChangeText={setSearchQuery} />
        {searchQuery ? <TouchableOpacity onPress={() => setSearchQuery('')}><X size={18} color={Colors.text.muted} /></TouchableOpacity> : null}
      </View>

      <FlatList
        data={paginatedUsers}
        keyExtractor={item => item.id}
        renderItem={renderUserItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={<View style={styles.emptyState}><UsersIcon size={48} color={Colors.text.muted} /><Text style={styles.emptyTitle}>No users found</Text><Text style={styles.emptySubtitle}>{searchQuery ? 'Try adjusting your search' : 'No users have registered yet'}</Text></View>}
      />

      {/* Pagination */}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <TouchableOpacity style={[styles.pageBtn, currentPage === 1 && styles.pageBtnDisabled]} disabled={currentPage === 1} onPress={() => setCurrentPage(p => p - 1)}><ChevronLeft size={18} color={currentPage === 1 ? Colors.text.muted : Colors.text.primary} /></TouchableOpacity>
          <Text style={styles.pageInfo}>Page {currentPage} of {totalPages}</Text>
          <TouchableOpacity style={[styles.pageBtn, currentPage === totalPages && styles.pageBtnDisabled]} disabled={currentPage === totalPages} onPress={() => setCurrentPage(p => p + 1)}><ChevronRight size={18} color={currentPage === totalPages ? Colors.text.muted : Colors.text.primary} /></TouchableOpacity>
        </View>
      )}

      {/* User Detail Modal */}
      <Modal visible={!!detailModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>User Details</Text>
              <TouchableOpacity onPress={() => setDetailModal(null)}><X size={24} color={Colors.text.primary} /></TouchableOpacity>
            </View>
            {detailModal && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <View style={styles.detailHeader}>
                  <View style={styles.detailAvatarContainer}>
                    {detailModal.avatar_url ? <Image source={{ uri: detailModal.avatar_url }} style={styles.detailAvatar} /> : <View style={styles.detailAvatarPlaceholder}><Text style={styles.detailAvatarText}>{(detailModal.full_name || detailModal.email || '?').charAt(0).toUpperCase()}</Text></View>}
                  </View>
                  <View style={styles.detailInfo}>
                    <Text style={styles.detailName}>{detailModal.full_name || 'Unknown'}</Text>
                    <Text style={styles.detailEmail}>{detailModal.email}</Text>
                    {detailModal.is_admin && <View style={styles.adminBadgeLarge}><Crown size={12} color={Colors.text.primary} /><Text style={styles.adminBadgeText}>Administrator</Text></View>}
                    {detailModal.status === 'suspended' && <View style={styles.suspendedBadgeLarge}><Lock size={12} color={Colors.text.primary} /><Text style={styles.suspendedBadgeText}>Suspended</Text></View>}
                  </View>
                </View>

                <View style={styles.detailGrid}>
                  <View style={styles.detailItem}><Mail size={14} color={Colors.text.muted} /><Text style={styles.detailLabel}>Email</Text><Text style={styles.detailValue}>{detailModal.email}</Text></View>
                  {detailModal.phone && <View style={styles.detailItem}><Phone size={14} color={Colors.text.muted} /><Text style={styles.detailLabel}>Phone</Text><Text style={styles.detailValue}>{detailModal.phone}</Text></View>}
                  {detailModal.username && <View style={styles.detailItem}><UsersIcon size={14} color={Colors.text.muted} /><Text style={styles.detailLabel}>Username</Text><Text style={styles.detailValue}>{detailModal.username}</Text></View>}
                  <View style={styles.detailItem}><Calendar size={14} color={Colors.text.muted} /><Text style={styles.detailLabel}>Joined</Text><Text style={styles.detailValue}>{new Date(detailModal.created_at).toLocaleDateString()}</Text></View>
                  <View style={styles.detailItem}><Clock size={14} color={Colors.text.muted} /><Text style={styles.detailLabel}>Watch Time</Text><Text style={styles.detailValue}>{formatWatchTime(detailModal.watch_time || 0)}</Text></View>
                  <View style={styles.detailItem}><Activity size={14} color={Colors.text.muted} /><Text style={styles.detailLabel}>Status</Text><Text style={styles.detailValue}>{detailModal.status || 'active'}</Text></View>
                </View>

                {/* Watch History */}
                <Text style={styles.sectionLabel}>Watch History</Text>
                {loadingDetail ? <Text style={styles.loadingText}>Loading...</Text> : userWatchHistory.length > 0 ? (
                  userWatchHistory.map((item, idx) => (
                    <View key={idx} style={styles.historyItem}>
                      <Image source={{ uri: item.videos?.thumbnail_url || `https://picsum.photos/seed/${item.video_id}/80/45` }} style={styles.historyThumb} />
                      <View style={styles.historyInfo}><Text style={styles.historyTitle} numberOfLines={1}>{item.videos?.title || 'Unknown'}</Text><Text style={styles.historyMeta}>{formatWatchTime(item.progress)} · {item.completed ? 'Completed' : 'In progress'}</Text></View>
                    </View>
                  ))
                ) : <Text style={styles.noDataText}>No watch history</Text>}

                {/* Recent Activity */}
                <Text style={styles.sectionLabel}>Recent Views</Text>
                {loadingDetail ? <Text style={styles.loadingText}>Loading...</Text> : userActivity.length > 0 ? (
                  userActivity.map((item, idx) => (
                    <View key={idx} style={styles.historyItem}>
                      <Image source={{ uri: item.videos?.thumbnail_url || `https://picsum.photos/seed/${item.video_id}/80/45` }} style={styles.historyThumb} />
                      <View style={styles.historyInfo}><Text style={styles.historyTitle} numberOfLines={1}>{item.videos?.title || 'Unknown'}</Text><Text style={styles.historyMeta}>{new Date(item.viewed_at).toLocaleDateString()}</Text></View>
                    </View>
                  ))
                ) : <Text style={styles.noDataText}>No recent views</Text>}

                {/* Actions */}
                <View style={styles.detailActions}>
                  {detailModal.status === 'suspended' ? (
                    <Button title="Reactivate User" onPress={() => setConfirmModal({ type: 'reactivate', user: detailModal })} style={styles.detailActionBtn} />
                  ) : (
                    <Button title="Suspend User" onPress={() => setConfirmModal({ type: 'suspend', user: detailModal })} variant="outline" style={styles.detailActionBtn} />
                  )}
                  {!detailModal.is_admin && <Button title="Delete User" onPress={() => setConfirmModal({ type: 'delete', user: detailModal })} style={{ ...styles.detailActionBtn, ...styles.deleteBtn }} />}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Confirmation Modal */}
      <Modal visible={!!confirmModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.confirmModalContent}>
            <View style={[styles.confirmIcon, confirmModal?.type === 'delete' ? styles.confirmIconDanger : confirmModal?.type === 'suspend' ? styles.confirmIconWarning : styles.confirmIconSuccess]}>
              {confirmModal?.type === 'delete' ? <Trash2 size={32} color={Colors.status.error} /> : confirmModal?.type === 'suspend' ? <UserX size={32} color={Colors.status.warning} /> : <UserCheck size={32} color={Colors.status.success} />}
            </View>
            <Text style={styles.confirmTitle}>
              {confirmModal?.type === 'delete' ? 'Delete User' : confirmModal?.type === 'suspend' ? 'Suspend User' : 'Reactivate User'}
            </Text>
            <Text style={styles.confirmMessage}>
              {confirmModal?.type === 'delete'
                ? `Are you sure you want to permanently delete ${confirmModal?.user.full_name || confirmModal?.user.email}? This will remove all their data, watch history, favorites, and activity.`
                : confirmModal?.type === 'suspend'
                ? `Are you sure you want to suspend ${confirmModal?.user.full_name || confirmModal?.user.email}? They will not be able to access the platform.`
                : `Reactivate ${confirmModal?.user.full_name || confirmModal?.user.email}? They will regain full access to the platform.`}
            </Text>
            <View style={styles.confirmFooter}>
              <Button title="Cancel" onPress={() => setConfirmModal(null)} variant="outline" style={styles.modalBtn} disabled={processing} />
              <Button title={processing ? 'Processing...' : confirmModal?.type === 'delete' ? 'Delete' : confirmModal?.type === 'suspend' ? 'Suspend' : 'Reactivate'} onPress={handleConfirmAction} loading={processing} disabled={processing} style={{ ...styles.modalBtn, ...(confirmModal?.type === 'delete' ? styles.deleteBtn : {}) }} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function formatWatchTime(seconds: number): string {
  const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  statsRow: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm, gap: Spacing.md },
  statItem: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  statValue: { fontSize: 20, fontWeight: FontWeights.bold, color: Colors.text.primary, marginTop: 4 },
  statLabel: { fontSize: FontSizes.xs, color: Colors.text.muted },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.input, borderRadius: BorderRadius.md, marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, marginLeft: Spacing.sm },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  userCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, marginBottom: Spacing.md, padding: Spacing.md, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  userCardSuspended: { borderColor: 'rgba(245, 158, 11, 0.3)', backgroundColor: 'rgba(245, 158, 11, 0.05)' },
  userInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatarContainer: { position: 'relative' },
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: FontWeights.bold, color: Colors.text.secondary },
  adminBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.card },
  suspendedBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: Colors.status.warning, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.card },
  userDetails: { flex: 1 },
  userName: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  userEmail: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: 2 },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 4 },
  metaText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  adminTag: { backgroundColor: Colors.primary, paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: BorderRadius.sm },
  adminTagText: { fontSize: 9, fontWeight: FontWeights.bold, color: Colors.text.primary },
  suspendedTag: { backgroundColor: Colors.status.warning, paddingHorizontal: Spacing.xs, paddingVertical: 1, borderRadius: BorderRadius.sm },
  suspendedTagText: { fontSize: 9, fontWeight: FontWeights.bold, color: Colors.text.primary },
  userActions: { flexDirection: 'row', gap: Spacing.xs },
  actionBtn: { padding: Spacing.xs, borderRadius: BorderRadius.sm },
  actionBtnSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  actionBtnWarning: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  actionBtnDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2, gap: Spacing.md },
  emptyTitle: { fontSize: FontSizes.lg, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
  emptySubtitle: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: Spacing.md, gap: Spacing.md },
  pageBtn: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  pageBtnDisabled: { opacity: 0.4 },
  pageInfo: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: Colors.border },
  modalTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  modalBody: { padding: Spacing.lg },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  detailAvatarContainer: { position: 'relative' },
  detailAvatar: { width: 64, height: 64, borderRadius: 32 },
  detailAvatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  detailAvatarText: { fontSize: 28, fontWeight: FontWeights.bold, color: Colors.text.secondary },
  detailInfo: { flex: 1 },
  detailName: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  detailEmail: { fontSize: FontSizes.md, color: Colors.text.secondary, marginTop: 2 },
  adminBadgeLarge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, alignSelf: 'flex-start', marginTop: 4 },
  adminBadgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.primary },
  suspendedBadgeLarge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.status.warning, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm, alignSelf: 'flex-start', marginTop: 4 },
  suspendedBadgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.bold, color: Colors.text.primary },
  detailGrid: { gap: Spacing.md, marginBottom: Spacing.lg },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  detailLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, width: 80 },
  detailValue: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium, flex: 1 },
  sectionLabel: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginTop: Spacing.md, marginBottom: Spacing.sm },
  loadingText: { fontSize: FontSizes.sm, color: Colors.text.muted, paddingVertical: Spacing.md },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.border },
  historyThumb: { width: 60, height: 34, borderRadius: BorderRadius.sm, backgroundColor: Colors.tertiary },
  historyInfo: { flex: 1 },
  historyTitle: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.medium },
  historyMeta: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  noDataText: { fontSize: FontSizes.sm, color: Colors.text.muted, paddingVertical: Spacing.md },
  detailActions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg, paddingBottom: Spacing.lg },
  detailActionBtn: { flex: 1 },
  deleteBtn: { backgroundColor: Colors.status.error },
  confirmModalContent: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', maxWidth: 400, width: '100%' },
  confirmIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  confirmIconDanger: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  confirmIconWarning: { backgroundColor: 'rgba(245, 158, 11, 0.1)' },
  confirmIconSuccess: { backgroundColor: 'rgba(34, 197, 94, 0.1)' },
  confirmTitle: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.sm },
  confirmMessage: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center', lineHeight: 22, marginBottom: Spacing.lg },
  confirmFooter: { flexDirection: 'row', gap: Spacing.md, width: '100%' },
  modalBtn: { flex: 1 },
});
