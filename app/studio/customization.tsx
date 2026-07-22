import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft,
  Image as ImageIcon,
  Save,
  Film,
  ListVideo,
  Globe,
  Mail,
  Twitter,
  Instagram,
  Youtube,
  Facebook,
  Plus,
  X,
  Star,
  Play,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useToast } from '@/components/Toast';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function StudioCustomizationScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { user, profile } = useAuth();
  const toast = useToast();
  const [bannerFile, setBannerFile] = useState<any>(null);
  const [logoFile, setLogoFile] = useState<any>(null);
  const [description, setDescription] = useState(profile?.bio || '');
  const [contactEmail, setContactEmail] = useState((profile as any)?.contact_email || '');
  const [featuredVideoId, setFeaturedVideoId] = useState((profile as any)?.featured_video_id || '');
  const [trailerVideoId, setTrailerVideoId] = useState((profile as any)?.trailer_video_id || '');
  const [socialLinks, setSocialLinks] = useState<{ platform: string; url: string; icon: any }[]>(
    (profile as any)?.social_links
      ? JSON.parse((profile as any).social_links).map((s: any) => ({
          ...s,
          icon: s.platform === 'twitter' ? Twitter : s.platform === 'instagram' ? Instagram : s.platform === 'youtube' ? Youtube : Facebook,
        }))
      : []
  );
  const [newSocialUrl, setNewSocialUrl] = useState('');
  const [newSocialPlatform, setNewSocialPlatform] = useState('twitter');
  const [saving, setSaving] = useState(false);
  const [currentBannerUrl, setCurrentBannerUrl] = useState((profile as any)?.banner_url || null);
  const [currentLogoUrl, setCurrentLogoUrl] = useState(profile?.avatar_url || null);

  const socialPlatforms = [
    { value: 'twitter', label: 'Twitter', icon: Twitter },
    { value: 'instagram', label: 'Instagram', icon: Instagram },
    { value: 'youtube', label: 'YouTube', icon: Youtube },
    { value: 'facebook', label: 'Facebook', icon: Facebook },
  ];

  const pickImage = async (type: 'banner' | 'logo') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: type === 'banner' ? [16, 5] : [1, 1],
      });
      if (!result.canceled && result.assets?.length > 0) {
        if (type === 'banner') setBannerFile(result.assets[0]);
        else setLogoFile(result.assets[0]);
        toast.success(`${type === 'banner' ? 'Banner' : 'Logo'} selected`);
      }
    } catch (error) {
      toast.error('Failed to pick image', 'Please try again');
    }
  };

  const handleAddSocial = () => {
    if (!newSocialUrl.trim()) return;
    const platformData = socialPlatforms.find((p) => p.value === newSocialPlatform);
    if (!platformData) return;
    setSocialLinks((prev) => [...prev, { platform: newSocialPlatform, url: newSocialUrl.trim(), icon: platformData.icon }]);
    setNewSocialUrl('');
  };

  const handleRemoveSocial = (index: number) => {
    setSocialLinks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      let bannerUrl = currentBannerUrl;
      let logoUrl = currentLogoUrl;

      if (bannerFile && user) {
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

      if (logoFile && user) {
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

      const socialLinksJson = JSON.stringify(socialLinks.map(({ icon, ...rest }) => rest));

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          bio: description.trim() || null,
          avatar_url: logoUrl,
          banner_url: bannerUrl,
          contact_email: contactEmail.trim() || null,
          featured_video_id: featuredVideoId.trim() || null,
          trailer_video_id: trailerVideoId.trim() || null,
          social_links: socialLinksJson,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      toast.success('Channel saved', 'Your customization has been updated');
    } catch (error: any) {
      toast.error('Save failed', error.message || 'Please try again');
    } finally {
      setSaving(false);
    }
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
            <Text style={styles.headerTitle}>Channel Customization</Text>
          </View>

          {/* Banner */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Channel Banner</Text>
            <TouchableOpacity style={styles.bannerContainer} onPress={() => pickImage('banner')} activeOpacity={0.8}>
              {(bannerFile || currentBannerUrl) ? (
                <Image source={{ uri: bannerFile?.uri || currentBannerUrl || '' }} style={styles.bannerImage} resizeMode="cover" />
              ) : (
                <View style={styles.bannerPlaceholder}>
                  <ImageIcon size={32} color={Colors.text.muted} />
                  <Text style={styles.placeholderText}>Upload Banner</Text>
                  <Text style={styles.placeholderHint}>Recommended: 2560 x 1440</Text>
                </View>
              )}
              <View style={styles.bannerOverlay}>
                <Text style={styles.bannerChangeText}>Change Banner</Text>
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Logo */}
          <Animated.View entering={FadeInDown.delay(50).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Channel Logo</Text>
            <TouchableOpacity style={styles.logoContainer} onPress={() => pickImage('logo')} activeOpacity={0.8}>
              {(logoFile || currentLogoUrl) ? (
                <Image source={{ uri: logoFile?.uri || currentLogoUrl || '' }} style={styles.logoImage} resizeMode="cover" />
              ) : (
                <View style={styles.logoPlaceholder}>
                  <ImageIcon size={28} color={Colors.text.muted} />
                </View>
              )}
              <View style={styles.logoChangeBadge}>
                <ImageIcon size={14} color={Colors.text.primary} />
              </View>
            </TouchableOpacity>
            <Text style={styles.logoHint}>Recommended: 800 x 800 (square)</Text>
          </Animated.View>

          {/* Description */}
          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Input
              label="Channel Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Tell viewers about your channel..."
              multiline
              numberOfLines={4}
            />
          </Animated.View>

          {/* Contact Email */}
          <Animated.View entering={FadeInDown.delay(150).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Email</Text>
            <Input
              label="Business Email"
              value={contactEmail}
              onChangeText={setContactEmail}
              placeholder="contact@example.com"
              keyboardType="email-address"
              leftIcon={<Mail size={18} color={Colors.text.muted} />}
            />
          </Animated.View>

          {/* Featured Video & Trailer */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Featured Content</Text>
            <Input
              label="Featured Video ID"
              value={featuredVideoId}
              onChangeText={setFeaturedVideoId}
              placeholder="Paste video ID"
              leftIcon={<Star size={18} color={Colors.text.muted} />}
            />
            <Input
              label="Channel Trailer (for new visitors)"
              value={trailerVideoId}
              onChangeText={setTrailerVideoId}
              placeholder="Paste video ID"
              leftIcon={<Play size={18} color={Colors.text.muted} />}
            />
          </Animated.View>

          {/* Social Links */}
          <Animated.View entering={FadeInDown.delay(250).duration(300)} style={styles.section}>
            <Text style={styles.sectionTitle}>Social Links</Text>
            {socialLinks.map((link, i) => (
              <View key={i} style={styles.socialLinkRow}>
                <View style={styles.socialLinkIcon}>
                  <link.icon size={18} color={Colors.text.secondary} />
                </View>
                <View style={styles.socialLinkInfo}>
                  <Text style={styles.socialLinkPlatform}>{link.platform}</Text>
                  <Text style={styles.socialLinkUrl} numberOfLines={1}>{link.url}</Text>
                </View>
                <TouchableOpacity onPress={() => handleRemoveSocial(i)} style={styles.removeSocialBtn}>
                  <X size={16} color={Colors.status.error} />
                </TouchableOpacity>
              </View>
            ))}

            <View style={styles.addSocialRow}>
              <View style={styles.platformPicker}>
                {socialPlatforms.map((p) => (
                  <TouchableOpacity
                    key={p.value}
                    style={[styles.platformBtn, newSocialPlatform === p.value && styles.platformBtnActive]}
                    onPress={() => setNewSocialPlatform(p.value)}
                  >
                    <p.icon size={16} color={newSocialPlatform === p.value ? Colors.primary : Colors.text.muted} />
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={styles.socialInput}
                value={newSocialUrl}
                onChangeText={setNewSocialUrl}
                placeholder="https://..."
                placeholderTextColor={Colors.text.muted}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.addSocialBtn} onPress={handleAddSocial} disabled={!newSocialUrl.trim()}>
                <Plus size={18} color={newSocialUrl.trim() ? Colors.primary : Colors.text.muted} />
              </TouchableOpacity>
            </View>
          </Animated.View>

          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={saving}
            disabled={saving}
            style={styles.saveButton}
            icon={<Save size={18} color={Colors.text.primary} />}
          />
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
  bannerContainer: { borderRadius: BorderRadius.lg, overflow: 'hidden', position: 'relative' },
  bannerImage: { width: '100%', height: 140, borderRadius: BorderRadius.lg },
  bannerPlaceholder: { height: 140, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center', gap: Spacing.xs, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  placeholderText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  placeholderHint: { fontSize: FontSizes.xs, color: Colors.text.muted },
  bannerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  bannerChangeText: { fontSize: FontSizes.sm, color: Colors.text.primary, fontWeight: FontWeights.semibold },
  logoContainer: { alignSelf: 'flex-start', position: 'relative' },
  logoImage: { width: 80, height: 80, borderRadius: 40 },
  logoPlaceholder: { width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed' },
  logoChangeBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.primary, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: Colors.background },
  logoHint: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: Spacing.xs },
  socialLinkRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.xs, gap: Spacing.md },
  socialLinkIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  socialLinkInfo: { flex: 1 },
  socialLinkPlatform: { fontSize: FontSizes.sm, fontWeight: FontWeights.semibold, color: Colors.text.primary, textTransform: 'capitalize' },
  socialLinkUrl: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  removeSocialBtn: { padding: Spacing.xs },
  addSocialRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.sm },
  platformPicker: { flexDirection: 'row', gap: 4 },
  platformBtn: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  platformBtnActive: { borderColor: Colors.primary, backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  socialInput: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, color: Colors.text.primary, fontSize: FontSizes.sm, borderWidth: 1, borderColor: Colors.border },
  addSocialBtn: { padding: Spacing.sm },
  saveButton: { marginTop: Spacing.lg },
});
