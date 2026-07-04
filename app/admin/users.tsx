import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Image,
  RefreshControl,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Search, Shield, User, Mail, Calendar, Crown } from 'lucide-react-native';
import { supabase, Profile } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function UsersScreen() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (data) setUsers(data as Profile[]);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/admin/login');
      return;
    }
    fetchUsers();
  }, [authLoading, user, isAdmin, router, fetchUsers]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }, [fetchUsers]);

  const toggleAdmin = async (targetUser: Profile) => {
    try {
      await supabase.from('profiles').update({ is_admin: !targetUser.is_admin }).eq('id', targetUser.id);
      setUsers((prev) => prev.map((u) => (u.id === targetUser.id ? { ...u, is_admin: !u.is_admin } : u)));
    } catch (error) {
      console.error('Error toggling admin:', error);
      Alert.alert('Error', 'Failed to update user role');
    }
  };

  if (authLoading || loading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>Access Denied</Text>
        </View>
      </View>
    );
  }

  const filteredUsers = searchQuery.trim()
    ? users.filter((u) => u.email.toLowerCase().includes(searchQuery.toLowerCase()) || u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()))
    : users;

  const formatDate = (date: string) => new Date(date).toLocaleDateString();

  const renderItem = ({ item }: { item: Profile }) => (
    <View style={styles.userCard}>
      <View style={styles.avatarContainer}>
        {item.avatar_url ? (
          <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <User size={24} color={Colors.text.secondary} />
          </View>
        )}
      </View>
      <View style={styles.userInfo}>
        <View style={styles.userNameRow}>
          <Text style={styles.userName}>{item.full_name || 'User'}</Text>
          {item.is_admin && (
            <View style={styles.adminBadge}>
              <Crown size={12} color={Colors.primary} />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>
        <View style={styles.userMeta}>
          <Mail size={12} color={Colors.text.muted} />
          <Text style={styles.userEmail}>{item.email}</Text>
        </View>
        <View style={styles.userMeta}>
          <Calendar size={12} color={Colors.text.muted} />
          <Text style={styles.userDate}>Joined {formatDate(item.created_at)}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => toggleAdmin(item)} style={[styles.adminToggle, item.is_admin && styles.adminToggleActive]}>
        <Shield size={20} color={item.is_admin ? Colors.primary : Colors.text.muted} fill={item.is_admin ? Colors.primary : 'transparent'} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Search size={20} color={Colors.text.muted} />
          <TextInput style={styles.searchInput} placeholder="Search users..." placeholderTextColor={Colors.text.muted} value={searchQuery} onChangeText={setSearchQuery} />
        </View>
      </View>
      <View style={styles.statsRow}>
        <Text style={styles.statsText}>{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}</Text>
        <Text style={styles.statsText}>{filteredUsers.filter((u) => u.is_admin).length} admin{filteredUsers.filter((u) => u.is_admin).length !== 1 ? 's' : ''}</Text>
      </View>
      <FlatList
        data={filteredUsers}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <User size={48} color={Colors.text.muted} />
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.sm },
  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.input, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 44 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: FontSizes.md, marginLeft: Spacing.sm },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  statsText: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  userCard: { flexDirection: 'row', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.md, alignItems: 'center' },
  avatarContainer: { marginRight: Spacing.md },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  userName: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(229, 9, 20, 0.1)', paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  adminBadgeText: { fontSize: FontSizes.xs, color: Colors.primary, fontWeight: FontWeights.semibold },
  userMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  userEmail: { fontSize: FontSizes.sm, color: Colors.text.secondary },
  userDate: { fontSize: FontSizes.sm, color: Colors.text.muted },
  adminToggle: { padding: Spacing.sm, borderRadius: BorderRadius.sm },
  adminToggleActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl * 2 },
  emptyText: { fontSize: FontSizes.md, color: Colors.text.muted, marginTop: Spacing.md },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
});
