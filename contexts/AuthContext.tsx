import React, { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Platform } from 'react-native';
import { supabase, Profile, Notification, VideoLike, type User } from '@/lib/supabase';
import { cache, CACHE_KEYS, CACHE_TTL } from '@/lib/cache';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string, fullName?: string, phone?: string, username?: string) => Promise<{ error: Error | null }>;
  signIn: (identifier: string, password: string) => Promise<{ error: Error | null }>;
  signInAsAdmin: (email: string, password: string) => Promise<{ error: Error | null; isAdmin: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: Error | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  checkUsernameExists: (username: string) => Promise<boolean>;
  checkPhoneExists: (phone: string) => Promise<boolean>;
  checkEmailExists: (email: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const initialized = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    const cached = cache.get<Profile>(CACHE_KEYS.profile(userId));
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      if (data) cache.set(CACHE_KEYS.profile(userId), data as Profile, CACHE_TTL.long);
      return data as Profile;
    } catch (error) {
      console.error('Error fetching profile:', error);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    if (profileData) {
      setProfile(profileData);
      setIsAdmin(!!profileData.is_admin);
    }
  }, [user, fetchProfile]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          if (profileData) {
            setProfile(profileData);
            setIsAdmin(!!profileData.is_admin);
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          const profileData = await fetchProfile(session.user.id);
          if (profileData) {
            setProfile(profileData);
            setIsAdmin(!!profileData.is_admin);
          }
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setProfile(null);
          setIsAdmin(false);
          setLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          setUser(session.user);
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const checkUsernameExists = useCallback(async (username: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .neq('id', user?.id || '')
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }, [user]);

  const checkPhoneExists = useCallback(async (phone: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone', phone)
        .neq('id', user?.id || '')
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }, [user]);

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .neq('id', user?.id || '')
        .maybeSingle();
      return !!data;
    } catch {
      return false;
    }
  }, [user]);

  const signUp = useCallback(async (email: string, password: string, fullName?: string, phone?: string, username?: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone,
            username,
          },
        },
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signIn = useCallback(async (identifier: string, password: string) => {
    try {
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
      let emailToUse = identifier;

      if (!isEmail) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('email')
          .eq('phone', identifier)
          .maybeSingle();

        if (!profileData) {
          return { error: new Error('No account found with this phone number') as Error };
        }
        emailToUse = profileData.email;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: emailToUse.toLowerCase().trim(),
        password,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const signInAsAdmin = useCallback(async (email: string, password: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        return { error: error as Error, isAdmin: false };
      }

      if (!data.user) {
        setLoading(false);
        return { error: new Error('Login failed - no user returned') as Error, isAdmin: false };
      }

      const profileData = await fetchProfile(data.user.id);

      if (!profileData || !profileData.is_admin) {
        await supabase.auth.signOut();
        setUser(null);
        setProfile(null);
        setIsAdmin(false);
        setLoading(false);
        return { error: new Error('Access denied. Admin privileges required.') as Error, isAdmin: false };
      }

      setUser(data.user);
      setProfile(profileData);
      setIsAdmin(true);
      setLoading(false);

      return { error: null, isAdmin: true };
    } catch (error) {
      setLoading(false);
      return { error: error as Error, isAdmin: false };
    }
  }, [fetchProfile]);

  const resetPassword = useCallback(async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/auth/reset-password` : undefined,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const updatePassword = useCallback(async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      return { error: error as Error | null };
    } catch (error) {
      return { error: error as Error };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    try {
      if (!user?.email) {
        return { error: new Error('No user logged in') as Error };
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });

      if (signInError) {
        return { error: new Error('Current password is incorrect') as Error };
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        return { error: updateError as Error };
      }

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut({ scope: 'global' });
    } catch (error) {
      console.error('Sign out error:', error);
    }

    setUser(null);
    setProfile(null);
    setIsAdmin(false);
    cache.clear();

    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('supabase') || key.includes('sb-'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      } catch (e) {
        // localStorage may not be available
      }
    }
  }, []);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, ...updates } : null);
      cache.set(CACHE_KEYS.profile(user.id), { ...profile, ...updates } as Profile, CACHE_TTL.long);
      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  }, [user, profile]);

  const contextValue = useMemo(() => ({
    user,
    profile,
    isAdmin,
    loading,
    signUp,
    signIn,
    signInAsAdmin,
    signOut,
    resetPassword,
    updatePassword,
    changePassword,
    updateProfile,
    refreshProfile,
    checkUsernameExists,
    checkPhoneExists,
    checkEmailExists,
  }), [
    user, profile, isAdmin, loading,
    signUp, signIn, signInAsAdmin, signOut, resetPassword,
    updatePassword, changePassword, updateProfile, refreshProfile,
    checkUsernameExists, checkPhoneExists, checkEmailExists,
  ]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
