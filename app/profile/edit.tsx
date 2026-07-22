import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, Trash2, User, Mail, Phone, AtSign, Check } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { supabase } from '@/lib/supabase';
import { uploadWithProgress, getImageMime } from '@/lib/storage';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { VALIDATION, sanitizeString, sanitizeFilename } from '@/lib/validation';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, profile, updateProfile, refreshProfile, checkUsernameExists, checkPhoneExists, checkEmailExists } = useAuth();
  useAuthGuard(true);

  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [email, setEmail] = useState(profile?.email || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [country, setCountry] = useState(profile?.country || '');
  const [language, setLanguage] = useState(profile?.language || 'English');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth || '');
  const [gender, setGender] = useState(profile?.gender || '');
  const [coverUrl, setCoverUrl] = useState<string | null>(profile?.banner_url || profile?.cover_url || null);
  const [coverFile, setCoverFile] = useState<any>(null);
  const [coverRemoved, setCoverRemoved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatar_url || null);
  const [avatarFile, setAvatarFile] = useState<any>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setUsername(profile.username || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setBio(profile.bio || '');
      setCountry(profile.country || '');
      setLanguage(profile.language || 'English');
      setDateOfBirth(profile.date_of_birth || '');
      setGender(profile.gender || '');
      setCoverUrl(profile.banner_url || profile.cover_url || null);
      setAvatarUrl(profile.avatar_url || null);
      setAvatarRemoved(false);
      setAvatarFile(null);
      setCoverRemoved(false);
      setCoverFile(null);
    }
  }, [profile]);

  const pickAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll permissions to upload a profile picture.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [1, 1],
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        // Validate file type and size
        const fileCheck = VALIDATION.imageFile({ name: asset.fileName || 'avatar.jpg', type: asset.mimeType, size: asset.fileSize });
        if (!fileCheck.valid) {
          Alert.alert('Invalid file', fileCheck.message || 'Please select a valid image file.');
          return;
        }
        setAvatarFile(asset);
        setAvatarUrl(asset.uri);
        setAvatarRemoved(false);
      }
    } catch (err) {
      console.error('Error picking avatar:', err);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const pickCover = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Please grant photo library permissions to upload a cover photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: true,
        aspect: [16, 9],
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        setCoverFile(result.assets[0]);
        setCoverUrl(result.assets[0].uri);
        setCoverRemoved(false);
      }
    } catch (err) {
      setError('Failed to pick cover image.');
    }
  };

  const removeCover = () => {
    setCoverFile(null);
    setCoverUrl(null);
    setCoverRemoved(true);
  };

  const uploadCover = async (): Promise<string | null> => {
    if (!coverFile || !user) return null;
    try {
      const rawExt = (coverFile.mimeType?.split('/')[1] || coverFile.uri?.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = sanitizeFilename(rawExt);
      const contentType = getImageMime(rawExt);
      const filePath = `${user.id}/${user.id}_cover_${Date.now()}.${safeExt}`;
      const response = await fetch(coverFile.uri);
      const blob = await response.blob();
      const result = await uploadWithProgress('cover-images', filePath, blob, contentType, () => {}, true, 2);
      return result.publicUrl;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload cover photo');
    }
  };

  const removeAvatar = () => {
    setAvatarFile(null);
    setAvatarUrl(null);
    setAvatarRemoved(true);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;

    try {
      const rawExt = (avatarFile.mimeType?.split('/')[1] || avatarFile.uri?.split('.').pop() || 'jpg').toLowerCase();
      const safeExt = sanitizeFilename(rawExt);
      const contentType = getImageMime(rawExt);
      const filePath = `${user.id}/${user.id}_${Date.now()}.${safeExt}`;

      const response = await fetch(avatarFile.uri);
      const blob = await response.blob();

      const result = await uploadWithProgress(
        'avatars',
        filePath,
        blob,
        contentType,
        () => {},
        true,
        2
      );

      return result.publicUrl;
    } catch (err: any) {
      console.error('Error uploading avatar:', err);
      throw new Error(err.message || 'Failed to upload profile picture');
    }
  };

  const deleteOldAvatar = async (oldUrl: string) => {
    try {
      const urlParts = oldUrl.split('/avatars/');
      if (urlParts.length < 2) return;
      const oldPath = urlParts[1].split('?')[0];
      if (oldPath) {
        await supabase.storage.from('avatars').remove([oldPath]);
      }
    } catch (err) {
      // Silent - old avatar cleanup is best-effort
    }
  };

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (username.trim() && username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (username.trim() && username !== profile?.username) {
      const exists = await checkUsernameExists(username.trim());
      if (exists) {
        newErrors.username = 'This username is already taken';
      }
    }

    if (phone.trim() && phone !== profile?.phone) {
      const phoneRegex = /^\+?[0-9]{10,15}$/;
      if (!phoneRegex.test(phone.trim())) {
        newErrors.phone = 'Please enter a valid phone number';
      } else {
        const exists = await checkPhoneExists(phone.trim());
        if (exists) {
          newErrors.phone = 'This phone number is already in use';
        }
      }
    }

    if (email.trim() && email !== profile?.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = 'Please enter a valid email';
      } else {
        const exists = await checkEmailExists(email.toLowerCase().trim());
        if (exists) {
          newErrors.email = 'This email is already in use';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    setError(null);
    setSuccess(false);

    const isValid = await validateForm();
    if (!isValid) return;

    setLoading(true);

    try {
      const updates: any = {
        full_name: sanitizeString(fullName, 50),
        username: sanitizeString(username, 20) || null,
        phone: phone.trim() || null,
        bio: sanitizeString(bio, 500) || null,
        country: sanitizeString(country, 50) || null,
        language: sanitizeString(language, 30) || null,
        date_of_birth: dateOfBirth.trim() || null,
        gender: gender.trim() || null,
      };

      if (coverFile) {
        try {
          const newCoverUrl = await uploadCover();
          if (newCoverUrl) {
            updates.banner_url = `${newCoverUrl}?t=${Date.now()}`;
          }
        } catch (coverErr: any) {
          setError(coverErr.message || 'Failed to upload cover photo');
          setLoading(false);
          return;
        }
      } else if (coverRemoved && (profile?.banner_url || profile?.cover_url)) {
        updates.banner_url = null;
      }

      // Handle avatar changes
      if (avatarFile) {
        try {
          const newAvatarUrl = await uploadAvatar();
          if (newAvatarUrl) {
            // Cache-bust the URL so Image component reloads it
            const cacheBustedUrl = `${newAvatarUrl}?t=${Date.now()}`;
            updates.avatar_url = cacheBustedUrl;
            // Clean up old avatar if there was one
            if (profile?.avatar_url) {
              await deleteOldAvatar(profile.avatar_url);
            }
          }
        } catch (uploadErr: any) {
          setError(uploadErr.message || 'Failed to upload profile picture');
          setLoading(false);
          return;
        }
      } else if (avatarRemoved && profile?.avatar_url) {
        // Avatar was removed
        updates.avatar_url = null;
        await deleteOldAvatar(profile.avatar_url);
      }

      // Handle email change
      if (email.trim() && email !== profile?.email) {
        const { error: emailError } = await supabase.auth.updateUser({ email: email.toLowerCase().trim() });
        if (emailError) {
          setError(emailError.message);
          setLoading(false);
          return;
        }
      }

      const { error: updateError } = await updateProfile(updates);

      if (updateError) {
        setError(updateError.message);
      } else {
        await refreshProfile();
        setSuccess(true);
        setTimeout(() => {
          router.back();
        }, 1500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={24} color={Colors.text.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>Update your personal information and profile picture</Text>

          <View style={styles.coverSection}>
            <View style={styles.coverContainer}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl, cache: 'reload' }} style={styles.cover} />
              ) : (
                <View style={[styles.cover, styles.coverPlaceholder]} />
              )}
              <TouchableOpacity style={styles.coverEditBtn} onPress={pickCover}>
                <Camera size={18} color={Colors.text.primary} />
              </TouchableOpacity>
              {coverUrl && (
                <TouchableOpacity style={styles.coverRemoveBtn} onPress={removeCover}>
                  <Trash2 size={16} color={Colors.status.error} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.avatarSection}>
            <View style={styles.avatarContainer}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl, cache: 'reload' }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={48} color={Colors.text.muted} />
                </View>
              )}
            </View>

            <View style={styles.avatarActions}>
              <TouchableOpacity style={styles.avatarButton} onPress={pickAvatar}>
                <Camera size={18} color={Colors.primary} />
                <Text style={styles.avatarButtonText}>
                  {avatarUrl ? 'Change' : 'Upload'}
                </Text>
              </TouchableOpacity>

              {avatarUrl && (
                <TouchableOpacity
                  style={[styles.avatarButton, styles.removeButton]}
                  onPress={removeAvatar}
                >
                  <Trash2 size={18} color={Colors.status.error} />
                  <Text style={styles.removeButtonText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {success && (
            <View style={styles.successBanner}>
              <Check size={20} color={Colors.status.success} />
              <Text style={styles.successText}>Profile updated successfully!</Text>
            </View>
          )}

          <View style={styles.form}>
            <Input
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              autoCapitalize="words"
              error={errors.fullName}
              leftIcon={<User size={20} color={Colors.text.muted} />}
            />

            <Input
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="Choose a username"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.username}
              leftIcon={<AtSign size={20} color={Colors.text.muted} />}
            />

            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              leftIcon={<Mail size={20} color={Colors.text.muted} />}
            />

            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
              autoCapitalize="none"
              error={errors.phone}
              leftIcon={<Phone size={20} color={Colors.text.muted} />}
            />

            <Input
              label="Bio"
              value={bio}
              onChangeText={setBio}
              placeholder="Tell viewers about yourself"
              multiline
            />

            <Input
              label="Country"
              value={country}
              onChangeText={setCountry}
              placeholder="e.g. United States"
              autoCapitalize="words"
            />

            <Input
              label="Language"
              value={language}
              onChangeText={setLanguage}
              placeholder="e.g. English"
              autoCapitalize="words"
            />

            <Input
              label="Date of Birth"
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD"
              autoCapitalize="none"
            />

            <Input
              label="Gender (optional)"
              value={gender}
              onChangeText={setGender}
              placeholder="e.g. Male, Female, Other"
              autoCapitalize="words"
            />

            <Button
              title={loading ? 'Saving...' : 'Save Changes'}
              onPress={handleSave}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  backText: {
    fontSize: FontSizes.md,
    color: Colors.text.primary,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    marginBottom: Spacing.xl,
  },
  coverSection: { marginBottom: Spacing.md },
  coverContainer: { position: 'relative', height: 180, borderRadius: BorderRadius.lg, overflow: 'hidden', backgroundColor: Colors.tertiary },
  cover: { width: '100%', height: '100%' },
  coverPlaceholder: { backgroundColor: '#1a1a2e' },
  coverEditBtn: { position: 'absolute', bottom: Spacing.sm, right: Spacing.sm, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  coverRemoveBtn: { position: 'absolute', top: Spacing.sm, right: Spacing.sm, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  avatarContainer: {
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarActions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  avatarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  avatarButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: Colors.status.error,
  },
  removeButtonText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.status.error,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.status.error,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  errorText: {
    color: Colors.status.error,
    fontSize: FontSizes.md,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderLeftWidth: 4,
    borderLeftColor: Colors.status.success,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  successText: {
    color: Colors.status.success,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
  },
  form: {
    gap: Spacing.sm,
  },
  submitButton: {
    marginTop: Spacing.lg,
  },
});
