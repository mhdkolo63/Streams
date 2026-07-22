import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
  Image,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  User,
  AtSign,
  Image as ImageIcon,
  Mail,
  Globe,
  Bell,
  Film,
  Eye,
  EyeOff,
  Lock,
  Check,
  Save,
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  Plus,
  X,
  Upload,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function StudioSettingsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user, profile, signOut } = useAuth();
  const toast = useToast();
  const [channelName, setChannelName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState((profile as any)?.username || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [contactEmail, setContactEmail] = useState((profile as any)?.contact_email || '');
  const [logoFile, setLogoFile] = useState<any>(null);
  const [bannerFile, setBannerFile] = useState<any>(null);
  const [currentLogo, setCurrentLogo] = useState(profile?.avatar_url || null);
  const [currentBanner, setCurrentBanner] = useState((profile as any)?.banner_url || null);

  // Notification preferences
  const [notifSubs, setNotifSubs] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifShares, setNotifShares] = useState(true);
  const [notifReports, setNotifReports] = useState(true);
  const [notifAdmin, setNotifAdmin] = useState(true);

  // Upload defaults
  const [defaultVisibility, setDefaultVisibility] = useState<'published' | 'unlisted' | 'private'>('published');
  const [defaultComments, setDefaultComments] = useState(true);
  const [defaultCategory, setDefaultCategory] = useState('');

  const [saving, setSaving] = useState(false);
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string }[]>([]);

  const visibilityOptions = [
    { value: 'published' as const, label: 'Public', icon: Eye },
    { value: 'unlisted' as const, label: 'Unlisted', icon: EyeOff },
    { value: 'private' as const, label: 'Private', icon: Lock },
  ];

  const pickImage = async (type: 'logo' | 'banner') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: type === 'logo' ? [1, 1] : [16, 5],
      });
      if (!result.canceled && result.assets?.length > 0) {
        if (type === 'logo') setLogoFile(result.assets[0]);
        else setBannerFile(result.assets[0]);
        toast.success(`${type === 'logo' ? 'Logo' : 'Banner'} selected`);
      }
    } catch (error) {
      toast.error('Failed to pick image', 'Please try again');
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let logoUrl = currentLogo;
      let bannerUrl = currentBanner;

      if (logoFile) {
        const ext = logoFile.uri?.split('.').pop() || 'jpg';
        const path = `${user.id}/logo_${Date.now()}.${ext}`;
        const response = await fetch(logoFile.uri);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: `image/${ext}` });
        if (!error) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(path);
          logoUrl = data.publicUrl;
        }
      }

      if (bannerFile) {
        const ext = bannerFile.uri?.split('.').pop() || 'jpg';
        const path = `${user.id}/banner_${Date.now()}.${ext}`;
        const response = await fetch(bannerFile.uri);
        const blob = await response.blob();
        const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: `image/${ext}` });
        if (!error) {
          const { data } = supabase.storage.from('avatars').getPublicUrl(path);
          bannerUrl = data.publicUrl;
        }
      }

      const notifPrefs = JSON.stringify({
        subscribers: notifSubs,
        comments: notifComments,
        likes: notifLikes,
        shares: notifShares,
        reports: notifReports,
        admin: notifAdmin,
      });

      const uploadDefaults = JSON.stringify({
        visibility: defaultVisibility,
        comments: defaultComments,
        category: defaultCategory,
      });

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: channelName.trim() || null,
          username: username.trim() || null,
          bio: bio.trim() || null,
          avatar_url: logoUrl,
          banner_url: bannerUrl,
          contact_email: contactEmail.trim() || null,
          notification_preferences: notifPrefs,
          upload_defaults: uploadDefaults,
          social_links: JSON.stringify(socialLinks),
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      toast.success('Settings saved', 'Your creator settings have been updated');
    } catch (error: any) {
      toast.error('Save failed', error.message || 'Please try again');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
              <ArrowLeft size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Creator Settings</Text>
          </View>

          {/* Channel Info */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Channel Information</Text>
            <Input label="Channel Name" value={channelName} onChangeText={setChannelName} placeholder="Your channel name" leftIcon={<User size={18} color={Colors.text.muted} />} />
            <Input label="Username" value={username} onChangeText={setUsername} placeholder="@username" leftIcon={<AtSign size={18} color={Colors.text.muted} />} autoCapitalize="none" />
            <Input label="Bio" value={bio} onChangeText={setBio} placeholder="Channel description" multiline numberOfLines={3} />
            <Input label="Contact Email" value={contactEmail} onChangeText={setContactEmail} placeholder="contact@example.com" keyboardType="email-address" leftIcon={<Mail size={18} color={Colors.text.muted} />} />
          </Animated.View>

          {/* Logo & Banner */}
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Channel Branding</Text>
            <View style={styles.brandingRow}>
              <TouchableOpacity style={styles.logoPicker} onPress={() => pickImage('logo')}>
                {logoFile || currentLogo ? (
                  <Image source={{ uri: logoFile?.uri || currentLogo || '' }} style={styles.logoImage} resizeMode="cover" />
                ) : (
                  <View style={styles.logoPlaceholder}>
                    <ImageIcon size={20} color={Colors.text.muted} />
                  </View>
                )}
                <View style={styles.logoChangeBadge}>
                  <Upload size={12} color={Colors.text.primary} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.bannerPicker} onPress={() => pickImage('banner')}>
                {bannerFile || currentBanner ? (
                  <Image source={{ uri: bannerFile?.uri || currentBanner || '' }} style={styles.bannerImage} resizeMode="cover" />
                ) : (
                  <View style={styles.bannerPlaceholder}>
                    <ImageIcon size={20} color={Colors.text.muted} />
                    <Text style={styles.bannerPlaceholderText}>Banner</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>

          {/* Notification Preferences */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            <View style={styles.toggleList}>
              {[
                { label: 'New Subscribers', value: notifSubs, setter: setNotifSubs, icon: User },
                { label: 'Comments & Replies', value: notifComments, setter: setNotifComments, icon: Bell },
                { label: 'Likes', value: notifLikes, setter: setNotifLikes, icon: Bell },
                { label: 'Shares', value: notifShares, setter: setNotifShares, icon: Bell },
                { label: 'Reports', value: notifReports, setter: setNotifReports, icon: Bell },
                { label: 'Admin Messages', value: notifAdmin, setter: setNotifAdmin, icon: Bell },
              ].map((item, i) => (
                <View key={i} style={[styles.toggleRow, i < 5 && styles.toggleRowBorder]}>
                  <item.icon size={18} color={Colors.text.secondary} />
                  <Text style={styles.toggleLabel}>{item.label}</Text>
                  <Switch value={item.value} onValueChange={item.setter} trackColor={{ false: Colors.tertiary, true: Colors.primary }} thumbColor={Colors.text.primary} />
                </View>
              ))}
            </View>
          </Animated.View>

          {/* Upload Defaults */}
          <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Upload Defaults</Text>
            <Text style={styles.subLabel}>Default Visibility</Text>
            <View style={styles.visibilityRow}>
              {visibilityOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.visibilityOption, defaultVisibility === opt.value && styles.visibilityOptionActive]}
                  onPress={() => setDefaultVisibility(opt.value)}
                >
                  <opt.icon size={16} color={defaultVisibility === opt.value ? Colors.primary : Colors.text.muted} />
                  <Text style={[styles.visibilityText, defaultVisibility === opt.value && styles.visibilityTextActive]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.toggleRow}>
              <Bell size={18} color={Colors.text.secondary} />
              <Text style={styles.toggleLabel}>Comments enabled by default</Text>
              <Switch value={defaultComments} onValueChange={setDefaultComments} trackColor={{ false: Colors.tertiary, true: Colors.primary }} thumbColor={Colors.text.primary} />
            </View>
            <Input label="Default Category" value={defaultCategory} onChangeText={setDefaultCategory} placeholder="e.g. Entertainment" leftIcon={<Film size={18} color={Colors.text.muted} />} />
          </Animated.View>

          {/* Social Links */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Social Links</Text>
            {socialLinks.map((link, i) => (
              <View key={i} style={styles.socialLinkRow}>
                <Globe size={16} color={Colors.text.secondary} />
                <Text style={styles.socialLinkText} numberOfLines={1}>{link.url}</Text>
                <TouchableOpacity onPress={() => setSocialLinks((prev) => prev.filter((_, idx) => idx !== i))}>
                  <X size={16} color={Colors.status.error} />
                </TouchableOpacity>
              </View>
            ))}
            <TouchableOpacity style={styles.addSocialBtn} onPress={() => setSocialLinks((prev) => [...prev, { platform: 'website', url: 'https://' }])}>
              <Plus size={16} color={Colors.primary} />
              <Text style={styles.addSocialText}>Add Link</Text>
            </TouchableOpacity>
          </Animated.View>

          <Button
            title="Save All Changes"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
            icon={<Save size={18} color={Colors.text.primary} />}
          />

          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.xxl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xl, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.semibold, color: Colors.text.primary, marginBottom: Spacing.sm },
  subLabel: { fontSize: FontSizes.sm, color: Colors.text.muted, marginBottom: Spacing.xs },
  brandingRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  logoPicker: { position: 'relative' },
  logoImage: { width: 72, height: 72, borderRadius: 36 },
  logoPlaceholder: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  logoChangeBadge: { position: 'absolute', bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.background },
  bannerPicker: { flex: 1 },
  bannerImage: { width: '100%', height: 72, borderRadius: BorderRadius.md },
  bannerPlaceholder: { height: 72, backgroundColor: Colors.card, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center', gap: 4, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  bannerPlaceholderText: { fontSize: FontSizes.xs, color: Colors.text.muted },
  toggleList: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, minHeight: 48 },
  toggleRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  toggleLabel: { flex: 1, fontSize: FontSizes.md, color: Colors.text.primary, fontWeight: FontWeights.medium },
  visibilityRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md },
  visibilityOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 2, borderColor: 'transparent', justifyContent: 'center' },
  visibilityOptionActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.05)' },
  visibilityText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  visibilityTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  socialLinkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.xs },
  socialLinkText: { flex: 1, fontSize: FontSizes.sm, color: Colors.text.secondary },
  addSocialBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, backgroundColor: 'rgba(229, 9, 20, 0.1)', borderRadius: BorderRadius.md, alignSelf: 'flex-start' },
  addSocialText: { fontSize: FontSizes.sm, color: Colors.primary, fontWeight: FontWeights.semibold },
  saveButton: { marginTop: Spacing.lg },
  signOutBtn: { marginTop: Spacing.lg, paddingVertical: Spacing.md, borderRadius: BorderRadius.lg, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)', alignItems: 'center' },
  signOutText: { fontSize: FontSizes.md, color: Colors.status.error, fontWeight: FontWeights.semibold },
});
