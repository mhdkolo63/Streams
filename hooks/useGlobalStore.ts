import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export function useAuthGuard(requireAuth = true, requireAdmin = false) {
  const { user, profile, isAdmin, loading } = useAuth();
  const redirected = useRef(false);

  useEffect(() => {
    if (loading) return;

    if (requireAuth && !user) {
      if (!redirected.current) {
        redirected.current = true;
        if (requireAdmin) {
          router.replace('/admin/login');
        } else {
          router.replace('/auth/login');
        }
      }
      return;
    }

    if (requireAdmin && user && !isAdmin) {
      if (!redirected.current) {
        redirected.current = true;
        router.replace('/admin/login');
      }
      return;
    }

    redirected.current = false;
  }, [loading, user, isAdmin, requireAuth, requireAdmin]);

  return {
    user,
    profile,
    isAdmin,
    loading,
    authenticated: !!user,
  };
}

export function useGuestOnly() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading]);

  return { loading };
}
