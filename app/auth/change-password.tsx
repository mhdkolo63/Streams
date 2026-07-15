import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Lock, ArrowLeft, ArrowRight, CheckCircle, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

export default function ChangePasswordScreen() {
  const { changePassword } = useAuth();
  const router = useRouter();
  useAuthGuard(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const validateForm = () => {
    if (!currentPassword) {
      setError('Current password is required');
      return false;
    }

    if (!newPassword) {
      setError('New password is required');
      return false;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return false;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return false;
    }

    if (currentPassword === newPassword) {
      setError('New password must be different from current password');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setError(null);

    if (!validateForm()) return;

    setLoading(true);

    const { error } = await changePassword(currentPassword, newPassword);

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.heroGradient}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=600&fit=crop' }}
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay} />
        </View>

        <View style={styles.successContainer}>
          <CheckCircle size={64} color={Colors.status.success} />
          <Text style={styles.successTitle}>Password Changed</Text>
          <Text style={styles.successMessage}>
            Your password has been updated successfully. You can now use your new password to sign in.
          </Text>
          <Button
            title="Back to Profile"
            onPress={() => router.back()}
            style={styles.successButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.heroGradient}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=800&h=600&fit=crop' }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.heroOverlay} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={Colors.text.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Change Password</Text>
            <Text style={styles.subtitle}>
              Enter your current password and choose a new one
            </Text>
          </View>

          <View style={styles.form}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Input
                label="Current Password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                secureTextEntry={!showCurrentPassword}
                leftIcon={<Lock size={20} color={Colors.text.muted} />}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
              >
                {showCurrentPassword ? (
                  <EyeOff size={20} color={Colors.text.muted} />
                ) : (
                  <Eye size={20} color={Colors.text.muted} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Input
                label="New Password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                secureTextEntry={!showNewPassword}
                leftIcon={<Lock size={20} color={Colors.text.muted} />}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNewPassword(!showNewPassword)}
              >
                {showNewPassword ? (
                  <EyeOff size={20} color={Colors.text.muted} />
                ) : (
                  <Eye size={20} color={Colors.text.muted} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputWrapper}>
              <Input
                label="Confirm New Password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secureTextEntry={!showConfirmPassword}
                leftIcon={<Lock size={20} color={Colors.text.muted} />}
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? (
                  <EyeOff size={20} color={Colors.text.muted} />
                ) : (
                  <Eye size={20} color={Colors.text.muted} />
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.requirements}>
              <Text style={styles.requirementsTitle}>Password requirements:</Text>
              <Text style={[
                styles.requirement,
                newPassword.length >= 6 && styles.requirementMet
              ]}>
                {newPassword.length >= 6 ? '✓' : '○'} At least 6 characters
              </Text>
              <Text style={[
                styles.requirement,
                newPassword !== currentPassword && newPassword.length > 0 && styles.requirementMet
              ]}>
                {newPassword !== currentPassword && newPassword.length > 0 ? '✓' : '○'} Different from current password
              </Text>
              <Text style={[
                styles.requirement,
                newPassword === confirmPassword && confirmPassword.length > 0 && styles.requirementMet
              ]}>
                {newPassword === confirmPassword && confirmPassword.length > 0 ? '✓' : '○'} Passwords match
              </Text>
            </View>

            <Button
              title={loading ? 'Updating...' : 'Update Password'}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              icon={!loading && <ArrowRight size={18} color={Colors.text.primary} />}
              iconPosition="right"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  heroGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 11, 11, 0.7)',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  backText: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  form: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
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
  inputWrapper: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 38,
    padding: 4,
  },
  requirements: {
    backgroundColor: Colors.tertiary,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  requirementsTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  requirement: {
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
    marginBottom: Spacing.xs,
  },
  requirementMet: {
    color: Colors.status.success,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  successTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  successMessage: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },
  successButton: {
    width: '100%',
  },
});
