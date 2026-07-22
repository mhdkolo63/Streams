import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider } from '@/contexts/AuthContext';
import { ToastProvider } from '@/components/Toast';
import { MiniPlayerProvider } from '@/contexts/MiniPlayerContext';
import { AccessibilityProvider } from '@/contexts/AccessibilityContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import { MiniPlayer } from '@/components/MiniPlayer';

export default function RootLayout() {
  useFrameworkReady();

  return (
    <ErrorBoundary>
      <AccessibilityProvider>
        <AuthProvider>
          <MiniPlayerProvider>
            <ToastProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="+not-found" />
              </Stack>
              <MiniPlayer />
              <StatusBar style="light" />
            </ToastProvider>
          </MiniPlayerProvider>
        </AuthProvider>
      </AccessibilityProvider>
    </ErrorBoundary>
  );
}
