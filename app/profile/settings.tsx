import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  Moon,
  Globe,
  Shield,
  Play,
  Download,
  Info,
  ChevronRight,
  Trash2,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { SubPageHeader } from '@/components/SubPageHeader';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function SettingsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { signOut } = useAuth();
  const [autoplay, setAutoplay] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Clear all cached data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', onPress: () => Alert.alert('Done', 'Cache cleared successfully') },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const sections: {
    title: string;
    items: {
      icon: typeof Bell;
      label: string;
      type: 'toggle' | 'link' | 'action';
      value?: boolean;
      onToggle?: () => void;
      onPress?: () => void;
    }[];
  }[] = [
    {
      title: 'Playback',
      items: [
        { icon: Play, label: 'Autoplay Next Video', type: 'toggle', value: autoplay, onToggle: () => setAutoplay(!autoplay) },
        { icon: Download, label: 'Data Saver', type: 'toggle', value: dataSaver, onToggle: () => setDataSaver(!dataSaver) },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { icon: Bell, label: 'Push Notifications', type: 'toggle', value: notifications, onToggle: () => setNotifications(!notifications) },
      ],
    },
    {
      title: 'Privacy & Security',
      items: [
        { icon: Shield, label: 'Privacy Policy', type: 'link', onPress: () => router.push('/privacy') },
      ],
    },
    {
      title: 'Data',
      items: [
        { icon: Trash2, label: 'Clear Cache', type: 'action', onPress: handleClearCache },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <SubPageHeader title="Settings" subtitle="Customize your experience" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {sections.map((section, sectionIndex) => (
          <Animated.View key={section.title} entering={FadeInDown.delay(sectionIndex * 100).duration(300)}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.section}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.item,
                    itemIndex < section.items.length - 1 && styles.itemBorder,
                  ]}
                  onPress={item.type === 'link' || item.type === 'action' ? item.onPress : undefined}
                  disabled={item.type === 'toggle'}
                  activeOpacity={0.7}
                >
                  <item.icon size={20} color={Colors.text.secondary} />
                  <Text style={styles.itemLabel}>{item.label}</Text>

                  {item.type === 'toggle' && (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: Colors.tertiary, true: Colors.primary }}
                      thumbColor={Colors.text.primary}
                    />
                  )}

                  {(item.type === 'link' || item.type === 'action') && (
                    <ChevronRight size={18} color={Colors.text.muted} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        ))}

        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut} activeOpacity={0.7}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>StreamWorld v2.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  sectionTitle: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.muted,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    minHeight: 52,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemLabel: {
    flex: 1,
    fontSize: FontSizes.md,
    color: Colors.text.primary,
    fontWeight: FontWeights.medium,
  },
  signOutButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    alignItems: 'center',
  },
  signOutText: {
    fontSize: FontSizes.md,
    color: Colors.status.error,
    fontWeight: FontWeights.semibold,
  },
  versionText: {
    fontSize: FontSizes.xs,
    color: Colors.text.muted,
    textAlign: 'center',
    marginTop: Spacing.lg,
  },
});
