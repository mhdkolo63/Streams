import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, User, LogOut, Shield, Save } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function AdminSettingsScreen() {
  const router = useRouter();
  const { user, profile, isAdmin, loading: authLoading, signOut, changePassword, updateProfile } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
    }
  }, [profile]);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !isAdmin) {
      router.replace('/admin/login');
    }
  }, [authLoading, user, isAdmin, router]);

  if (authLoading) return <LoadingScreen />;
  if (!user || !isAdmin) {
    return (
      <View style={styles.container}>
        <View style={styles.unauthorized}>
          <Text style={styles.unauthorizedText}>Access Denied</Text>
        </View>
      </View>
    );
  }

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'All password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoadingPassword(true);
    const { error } = await changePassword(currentPassword, newPassword);
    setLoadingPassword(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  };

  const handleUpdateProfile = async () => {
    if (!fullName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoadingProfile(true);
    const { error } = await updateProfile({ full_name: fullName.trim() });
    setLoadingProfile(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Profile updated successfully');
    }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Admin Profile</Text>
        <View style={styles.card}>
          <View style={styles.userInfo}>
            <View style={styles.avatarPlaceholder}>
              <User size={32} color={Colors.text.primary} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{profile?.full_name || 'Admin'}</Text>
              <Text style={styles.userEmail}>{profile?.email}</Text>
              {isAdmin && (
                <View style={styles.adminBadge}>
                  <Shield size={12} color={Colors.text.primary} />
                  <Text style={styles.adminBadgeText}>Admin</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Edit Profile</Text>
        <View style={styles.card}>
          <Input label="Full Name" value={fullName} onChangeText={setFullName} placeholder="Your name" />
          <Button
            title={loadingProfile ? 'Saving...' : 'Save Profile'}
            onPress={handleUpdateProfile}
            loading={loadingProfile}
            disabled={loadingProfile}
            icon={!loadingProfile && <Save size={18} color={Colors.text.primary} />}
            iconPosition="right"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <View style={styles.card}>
          <Input
            label="Current Password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Enter current password"
            secureTextEntry
            leftIcon={<Lock size={20} color={Colors.text.muted} />}
          />
          <Input
            label="New Password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Enter new password"
            secureTextEntry
            leftIcon={<Lock size={20} color={Colors.text.muted} />}
          />
          <Input
            label="Confirm New Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Confirm new password"
            secureTextEntry
            leftIcon={<Lock size={20} color={Colors.text.muted} />}
          />
          <Button
            title={loadingPassword ? 'Updating...' : 'Update Password'}
            onPress={handleChangePassword}
            loading={loadingPassword}
            disabled={loadingPassword}
            icon={!loadingPassword && <Lock size={18} color={Colors.text.primary} />}
            iconPosition="right"
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.signOutCard} onPress={handleSignOut}>
          <LogOut size={20} color={Colors.status.error} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>StreamFlix Admin v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: Spacing.xxl },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.md },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.lg },
  userInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.lg },
  userDetails: { flex: 1 },
  userName: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginBottom: Spacing.xs },
  userEmail: { fontSize: FontSizes.md, color: Colors.text.secondary, marginBottom: Spacing.sm },
  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, backgroundColor: Colors.primary, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm, alignSelf: 'flex-start' },
  adminBadgeText: { fontSize: FontSizes.xs, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  signOutCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.lg, gap: Spacing.md },
  signOutText: { flex: 1, fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.status.error },
  version: { fontSize: FontSizes.sm, color: Colors.text.muted, textAlign: 'center', marginTop: Spacing.lg },
  unauthorized: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  unauthorizedText: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary },
});
