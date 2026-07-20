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
import { Mail, Lock, ArrowRight, Phone } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useGuestOnly } from '@/hooks/useGlobalStore';
import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

const { height } = Dimensions.get('window');

export default function LoginScreen() {
  const { loading: authLoading } = useGuestOnly();
  const { signIn } = useAuth();
  const router = useRouter();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (authLoading) {
    return <LoadingScreen />;
  }

  const validateForm = () => {
    let isValid = true;
    setIdentifierError(null);
    setPasswordError(null);

    if (!identifier.trim()) {
      setIdentifierError('Email or phone number is required');
      isValid = false;
    } else {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      const isPhone = /^\+?[0-9]{10,15}$/.test(identifier.trim());
      if (!isEmail && !isPhone) {
        setIdentifierError('Please enter a valid email or phone number');
        isValid = false;
      }
    }

    if (!password) {
      setPasswordError('Password is required');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    const { error } = await signIn(identifier.trim(), password);

    if (error) {
      setLoading(false);
      if (error.message.includes('Invalid login credentials')) {
        setError('Invalid email/phone or password');
      } else {
        setError(error.message);
      }
      return;
    }

    router.replace('/');
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
          <View style={styles.header}>
            <Text style={styles.title}>StreamWorld</Text>
            <Text style={styles.subtitle}>Watch anywhere. Cancel anytime.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.formTitle}>Sign In</Text>

            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Input
              label="Email or Phone Number"
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="Enter your email or phone"
              autoCapitalize="none"
              autoCorrect={false}
              error={identifierError || undefined}
              leftIcon={<Mail size={20} color={Colors.text.muted} />}
            />

            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
              error={passwordError || undefined}
              leftIcon={<Lock size={20} color={Colors.text.muted} />}
            />

            <TouchableOpacity
              onPress={() => router.push('/auth/forgot-password')}
              style={styles.forgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              title={loading ? 'Signing in...' : 'Sign In'}
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.submitButton}
              icon={!loading && <ArrowRight size={18} color={Colors.text.primary} />}
              iconPosition="right"
            />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>New to StreamWorld?</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity onPress={() => router.push('/auth/register')}>
              <Text style={styles.registerText}>
                Create an account
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
    marginBottom: Spacing.xxl,
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: Spacing.lg,
  },
  forgotPasswordText: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
  },
  submitButton: {
    marginTop: Spacing.md,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    color: Colors.text.muted,
    fontSize: FontSizes.sm,
    marginHorizontal: Spacing.md,
  },
  registerText: {
    color: Colors.primary,
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
});
