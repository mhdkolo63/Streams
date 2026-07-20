import React, { useState } from 'react';
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
import { Mail, Lock, User, ArrowRight, Phone, AtSign, CheckCircle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestOnly } from '@/hooks/useGlobalStore';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { VALIDATION, sanitizeString, sanitizeEmail } from '@/lib/validation';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { height } = Dimensions.get('window');

type ContactMethod = 'email' | 'phone';

export default function RegisterScreen() {
  const { loading: authLoading } = useGuestOnly();
  const { signUp, checkEmailExists, checkPhoneExists, checkUsernameExists } = useAuth();
  const router = useRouter();

  const [contactMethod, setContactMethod] = useState<ContactMethod>('email');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (authLoading) {
    return <LoadingScreen />;
  }

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};
    let isValid = true;

    if (!fullName.trim()) {
      newErrors.fullName = 'Full name is required';
      isValid = false;
    }

    if (!username.trim()) {
      newErrors.username = 'Username is required';
      isValid = false;
    } else if (username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
      isValid = false;
    } else {
      const exists = await checkUsernameExists(username.trim());
      if (exists) {
        newErrors.username = 'This username is already taken';
        isValid = false;
      }
    }

    if (contactMethod === 'email') {
      if (!email.trim()) {
        newErrors.email = 'Email is required';
        isValid = false;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        newErrors.email = 'Please enter a valid email';
        isValid = false;
      } else {
        const exists = await checkEmailExists(email.toLowerCase().trim());
        if (exists) {
          newErrors.email = 'An account with this email already exists';
          isValid = false;
        }
      }
    } else {
      if (!phone.trim()) {
        newErrors.phone = 'Phone number is required';
        isValid = false;
      } else if (!/^\+?[0-9]{10,15}$/.test(phone.trim())) {
        newErrors.phone = 'Please enter a valid phone number';
        isValid = false;
      } else {
        const exists = await checkPhoneExists(phone.trim());
        if (exists) {
          newErrors.phone = 'An account with this phone already exists';
          isValid = false;
        }
      }
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else {
      const pwCheck = VALIDATION.password(password);
      if (!pwCheck.valid) {
        newErrors.password = pwCheck.message || 'Password is too weak';
        isValid = false;
      }
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    setError(null);
    setErrors({});

    const isValid = await validateForm();
    if (!isValid) return;

    setLoading(true);

    try {
      const signUpEmail =
        contactMethod === 'email'
          ? email.toLowerCase().trim()
          : `${phone.trim().replace(/[^0-9]/g, '')}@phone.streamworld.app`;

      const { error: signUpError } = await signUp(
        signUpEmail,
        password,
        fullName.trim(),
        contactMethod === 'phone' ? phone.trim() : undefined,
        username.trim()
      );

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Failed to create account');
      setLoading(false);
    }
  };

  if (success) {
    return (
      <View style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <CheckCircle size={64} color={Colors.status.success} />
          </View>
          <Text style={styles.successTitle}>Account Created!</Text>
          <Text style={styles.successMessage}>
            Your account has been created successfully. You can now sign in with your credentials.
          </Text>
          <Button
            title="Sign In Now"
            onPress={() => router.replace('/auth/login')}
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
          source={{ uri: 'https://images.unsplash.com/photo-1478720568477-1523109604902?w=800&h=600&fit=crop' }}
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
          <View style={styles.header}>
            <Text style={styles.title}>StreamWorld</Text>
            <Text style={styles.subtitle}>Start your streaming journey</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Create Account</Text>

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.toggleContainer}>
              <TouchableOpacity
                style={[styles.toggleButton, contactMethod === 'email' && styles.toggleButtonActive]}
                onPress={() => setContactMethod('email')}
              >
                <Mail size={16} color={contactMethod === 'email' ? Colors.text.primary : Colors.text.secondary} />
                <Text style={[styles.toggleText, contactMethod === 'email' && styles.toggleTextActive]}>Email</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleButton, contactMethod === 'phone' && styles.toggleButtonActive]}
                onPress={() => setContactMethod('phone')}
              >
                <Phone size={16} color={contactMethod === 'phone' ? Colors.text.primary : Colors.text.secondary} />
                <Text style={[styles.toggleText, contactMethod === 'phone' && styles.toggleTextActive]}>Phone</Text>
              </TouchableOpacity>
            </View>

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

            {contactMethod === 'email' ? (
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
            ) : (
              <Input
                label="Phone Number"
                value={phone}
                onChangeText={setPhone}
                placeholder="e.g., +1234567890"
                keyboardType="phone-pad"
                autoCapitalize="none"
                error={errors.phone}
                leftIcon={<Phone size={20} color={Colors.text.muted} />}
              />
            )}

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Create a password"
              secureTextEntry
              error={errors.password}
              leftIcon={<Lock size={20} color={Colors.text.muted} />}
            />

            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm your password"
              secureTextEntry
              error={errors.confirmPassword}
              leftIcon={<Lock size={20} color={Colors.text.muted} />}
            />

            <Button
              title={loading ? 'Creating account...' : 'Create Account'}
              onPress={handleRegister}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              icon={!loading ? <ArrowRight size={18} color={Colors.text.primary} /> : undefined}
              iconPosition="right"
            />

            <TouchableOpacity
              onPress={() => router.push('/auth/login')}
              style={styles.loginLink}
            >
              <Text style={styles.loginText}>
                Already have an account? <Text style={styles.loginTextHighlight}>Sign in</Text>
              </Text>
            </TouchableOpacity>
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
    paddingTop: height * 0.15,
    paddingBottom: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  title: {
    fontSize: FontSizes.display,
    fontWeight: FontWeights.bold,
    color: Colors.primary,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: FontSizes.lg,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  form: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  formTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.lg,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  toggleButtonActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.medium,
    color: Colors.text.secondary,
  },
  toggleTextActive: {
    color: Colors.text.primary,
    fontWeight: FontWeights.semibold,
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
  submitButton: {
    marginTop: Spacing.lg,
  },
  loginLink: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  loginText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.md,
  },
  loginTextHighlight: {
    color: Colors.primary,
    fontWeight: FontWeights.semibold,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  successIcon: {
    marginBottom: Spacing.lg,
  },
  successTitle: {
    fontSize: FontSizes.xxxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  successMessage: {
    fontSize: FontSizes.lg,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 24,
  },
  successButton: {
    width: '100%',
  },
});
