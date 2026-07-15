import { useEffect, useState } from 'react';
import { Stack, useRouter } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingScreen } from '@/components/Loading';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function AdminLayout() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [serverVerified, setServerVerified] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/admin/login');
      return;
    }
    if (!isAdmin) {
      setDenied(true);
      return;
    }

    // Server-side verification: re-check admin status from database
    // This prevents client-side tampering of isAdmin state
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .maybeSingle();

        if (error || !data || !data.is_admin) {
          setDenied(true);
          setServerVerified(false);
        } else {
          setServerVerified(true);
          setDenied(false);
        }
      } catch {
        setDenied(true);
      }
    })();
  }, [user, isAdmin, authLoading, router]);

  if (authLoading) return <LoadingScreen />;

  if (denied || (user && !isAdmin)) {
    return (
      <View style={styles.container}>
        <View style={styles.denied}>
          <AlertCircle size={48} color={Colors.status.error} />
          <Text style={styles.title}>Access Denied</Text>
          <Text style={styles.message}>You must be an administrator to access this area.</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.replace('/admin/login')}>
            <Text style={styles.buttonText}>Go to Admin Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!serverVerified) return <LoadingScreen />;

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.text.primary,
        headerTitleStyle: { fontWeight: '600' },
        contentStyle: { backgroundColor: Colors.background },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="videos" options={{ title: 'Manage Videos' }} />
      <Stack.Screen name="upload" options={{ title: 'Upload Video' }} />
      <Stack.Screen name="categories" options={{ title: 'Categories' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
      <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  denied: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xxl },
  title: { fontSize: FontSizes.xl, fontWeight: FontWeights.bold, color: Colors.text.primary, marginTop: Spacing.lg, marginBottom: Spacing.sm },
  message: { fontSize: FontSizes.md, color: Colors.text.secondary, textAlign: 'center' },
  button: { marginTop: Spacing.lg, backgroundColor: Colors.primary, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  buttonText: { color: Colors.text.primary, fontSize: FontSizes.md, fontWeight: FontWeights.semibold },
});
