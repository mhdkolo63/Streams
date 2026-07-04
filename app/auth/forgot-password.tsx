import React, { useState, useEffect, useRef } from 'react';
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
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, ArrowLeft, ArrowRight, CheckCircle, Shield } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [step, setStep] = useState<'email' | 'success'>('email');

  const validateEmail = () => {
    setEmailError(null);

    if (!email.trim()) {
      setEmailError('Email is required');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    setError(null);

    const { error } = await resetPassword(email.toLowerCase().trim());

    setLoading(false);

    if (error) {
      setError(error.message || 'Failed to send reset email. Please try again.');
    } else {
      setStep('success');
    }
  };

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
            <Text style={styles.backText}>Back to Login</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a secure link to reset your password.
            </Text>
          </View>

          <View style={styles.form}>
            {step === 'success' ? (
              <View style={styles.successContainer}>
                <View style={styles.iconContainer}>
                  <Mail size={32} color={Colors.text.primary} />
                </View>
                <Text style={styles.successTitle}>Check Your Email</Text>
                <Text style={styles.successMessage}>
                  We've sent a password reset link to{'\n'}
                  <Text style={styles.emailHighlight}>{email}</Text>
                </Text>
                <Text style={styles.successHint}>
                  Click the link in the email to reset your password. The link will expire in 1 hour.
                </Text>
                <Button
                  title="Back to Login"
                  onPress={() => router.push('/auth/login')}
                  style={styles.successButton}
                />
                <TouchableOpacity
                  style={styles.resendLink}
                  onPress={() => setStep('email')}
                >
                  <Text style={styles.resendText}>Didn't receive the email? Try again</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                {error && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                <View style={styles.emailInfo}>
                  <Mail size={24} color={Colors.primary} />
                  <Text style={styles.emailInfoText}>
                    We'll send a secure reset link to your email address. Click the link to create a new password.
                  </Text>
                </View>

                <Input
                  label="Email Address"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  error={emailError || undefined}
                  leftIcon={<Mail size={20} color={Colors.text.muted} />}
                />

                <Button
                  title={loading ? 'Sending...' : 'Send Reset Link'}
                  onPress={handleSubmit}
                  loading={loading}
                  disabled={loading}
                  style={styles.submitButton}
                  icon={!loading && <ArrowRight size={18} color={Colors.text.primary} />}
                  iconPosition="right"
                />

                <TouchableOpacity
                  style={styles.loginLink}
                  onPress={() => router.push('/auth/login')}
                >
                  <Text style={styles.loginText}>
                    Remember your password? <Text style={styles.loginTextBold}>Sign in</Text>
                  </Text>
                </TouchableOpacity>
              </>
            )}
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
  emailInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: `${Colors.primary}15`,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  emailInfoText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
    lineHeight: 20,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  loginText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.md,
  },
  loginTextBold: {
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.md,
  },
  successMessage: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  emailHighlight: {
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  successHint: {
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  successButton: {
    width: '100%',
  },
  resendLink: {
    marginTop: Spacing.md,
  },
  resendText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
  },
});
