import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Linking,
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
  Settings as SettingsIcon,
  Type,
  Contrast,
  Volume2,
  Wifi,
  HardDrive,
  HelpCircle,
  Star,
  FileText,
  Lock,
  Eye,
  Zap,
  Languages,
  Palette,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useAuth } from '@/contexts/AuthContext';
import { useAuthGuard } from '@/hooks/useGlobalStore';
import { useAccessibility, FontScale } from '@/contexts/AccessibilityContext';
import { SubPageHeader } from '@/components/SubPageHeader';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

type Section = {
  title: string;
  items: SettingsItem[];
};

type SettingsItem = {
  icon: typeof Bell;
  label: string;
  sublabel?: string;
  type: 'toggle' | 'link' | 'action' | 'select';
  value?: boolean;
  onToggle?: () => void;
  onPress?: () => void;
  selectedValue?: string;
};

export default function SettingsScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const { signOut } = useAuth();
  const { fontScale, setFontScale, highContrast, setHighContrast, reduceMotion, setReduceMotion } = useAccessibility();

  const [autoplay, setAutoplay] = useState(true);
  const [dataSaver, setDataSaver] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [notifUploads, setNotifUploads] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifSubscribers, setNotifSubscribers] = useState(true);
  const [pauseOnSeek, setPauseOnSeek] = useState(false);
  const [backgroundPlay, setBackgroundPlay] = useState(false);
  const [watchHistory, setWatchHistory] = useState(true);
  const [searchHistory, setSearchHistory] = useState(true);
  const [wifiOnly, setWifiOnly] = useState(true);
  const [smartDownloads, setSmartDownloads] = useState(false);
  const [language, setLanguage] = useState('English');
  const [showLanguageOptions, setShowLanguageOptions] = useState(false);

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Clear all cached data?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', onPress: () => Alert.alert('Done', 'Cache cleared successfully') },
    ]);
  };

  const handleClearHistory = () => {
    Alert.alert('Clear Watch History', 'Remove all watch history? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Done', 'Watch history cleared') },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  const languages = ['English', 'Spanish', 'French', 'German', 'Portuguese', 'Arabic', 'Hindi', 'Japanese', 'Korean', 'Chinese'];

  const fontScaleOptions: { label: string; value: FontScale }[] = [
    { label: 'Small', value: 'small' },
    { label: 'Default', value: 'medium' },
    { label: 'Large', value: 'large' },
    { label: 'Extra Large', value: 'xlarge' },
  ];

  const sections: Section[] = [
    {
      title: 'General',
      items: [
        { icon: Languages, label: 'Language', type: 'select', selectedValue: language, onPress: () => setShowLanguageOptions(!showLanguageOptions) },
      ],
    },
    {
      title: 'Playback',
      items: [
        { icon: Play, label: 'Autoplay Next Video', type: 'toggle', value: autoplay, onToggle: () => setAutoplay(!autoplay) },
        { icon: Zap, label: 'Data Saver', type: 'toggle', value: dataSaver, onToggle: () => setDataSaver(!dataSaver) },
        { icon: Eye, label: 'Pause on Seek', type: 'toggle', value: pauseOnSeek, onToggle: () => setPauseOnSeek(!pauseOnSeek) },
        { icon: Volume2, label: 'Background Playback', sublabel: 'Continue audio when switching apps', type: 'toggle', value: backgroundPlay, onToggle: () => setBackgroundPlay(!backgroundPlay) },
      ],
    },
    {
      title: 'Notifications',
      items: [
        { icon: Bell, label: 'Push Notifications', type: 'toggle', value: notifications, onToggle: () => setNotifications(!notifications) },
        { icon: Play, label: 'New Uploads', type: 'toggle', value: notifUploads, onToggle: () => setNotifUploads(!notifUploads) },
        { icon: Info, label: 'Comments & Replies', type: 'toggle', value: notifComments, onToggle: () => setNotifComments(!notifComments) },
        { icon: Star, label: 'Likes', type: 'toggle', value: notifLikes, onToggle: () => setNotifLikes(!notifLikes) },
        { icon: Globe, label: 'New Subscribers', type: 'toggle', value: notifSubscribers, onToggle: () => setNotifSubscribers(!notifSubscribers) },
      ],
    },
    {
      title: 'Privacy',
      items: [
        { icon: Eye, label: 'Watch History', type: 'toggle', value: watchHistory, onToggle: () => setWatchHistory(!watchHistory) },
        { icon: Globe, label: 'Search History', type: 'toggle', value: searchHistory, onToggle: () => setSearchHistory(!searchHistory) },
        { icon: Trash2, label: 'Clear Watch History', type: 'action', onPress: handleClearHistory },
        { icon: Shield, label: 'Privacy Policy', type: 'link', onPress: () => router.push('/privacy') },
      ],
    },
    {
      title: 'Downloads',
      items: [
        { icon: Wifi, label: 'Wi-Fi Only', sublabel: 'Only download on Wi-Fi', type: 'toggle', value: wifiOnly, onToggle: () => setWifiOnly(!wifiOnly) },
        { icon: Download, label: 'Smart Downloads', sublabel: 'Auto-download next episode', type: 'toggle', value: smartDownloads, onToggle: () => setSmartDownloads(!smartDownloads) },
        { icon: HardDrive, label: 'Storage Management', type: 'link', onPress: () => router.push('/downloads') },
      ],
    },
    {
      title: 'Appearance',
      items: [
        { icon: Type, label: 'Font Size', type: 'select', selectedValue: fontScaleOptions.find(f => f.value === fontScale)?.label || 'Default', onPress: () => {} },
        { icon: Contrast, label: 'High Contrast Mode', type: 'toggle', value: highContrast, onToggle: () => setHighContrast(!highContrast) },
        { icon: Zap, label: 'Reduce Motion', type: 'toggle', value: reduceMotion, onToggle: () => setReduceMotion(!reduceMotion) },
      ],
    },
    {
      title: 'Data',
      items: [
        { icon: Trash2, label: 'Clear Cache', type: 'action', onPress: handleClearCache },
      ],
    },
    {
      title: 'About',
      items: [
        { icon: Info, label: 'About StreamWorld', sublabel: 'Version 2.0.0', type: 'link', onPress: () => {} },
        { icon: FileText, label: 'Terms of Service', type: 'link', onPress: () => {} },
        { icon: Shield, label: 'Privacy Policy', type: 'link', onPress: () => router.push('/privacy') },
        { icon: Star, label: 'Rate StreamWorld', type: 'link', onPress: () => {} },
      ],
    },
    {
      title: 'Help',
      items: [
        { icon: HelpCircle, label: 'Help Center', type: 'link', onPress: () => router.push('/help') },
        { icon: Bell, label: 'Report a Problem', type: 'link', onPress: () => {} },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <SubPageHeader title="Settings" subtitle="Customize your experience" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Font Size Quick Picker */}
        <Animated.View entering={FadeInDown.delay(0).duration(300)}>
          <Text style={styles.sectionTitle}>Accessibility</Text>
          <View style={styles.section}>
            <View style={styles.fontScaleRow}>
              <Type size={20} color={Colors.text.secondary} />
              <Text style={styles.itemLabel}>Font Size</Text>
              <View style={styles.fontScaleButtons}>
                {fontScaleOptions.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.fontScaleBtn, fontScale === opt.value && styles.fontScaleBtnActive]}
                    onPress={() => setFontScale(opt.value)}
                  >
                    <Text style={[styles.fontScaleBtnText, fontScale === opt.value && styles.fontScaleBtnTextActive]}>
                      {opt.label.charAt(0)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Language Options */}
        {showLanguageOptions && (
          <Animated.View entering={FadeInDown.duration(200)} style={styles.languageOptions}>
            {languages.map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.languageOption, language === lang && styles.languageOptionActive]}
                onPress={() => {
                  setLanguage(lang);
                  setShowLanguageOptions(false);
                }}
              >
                <Text style={[styles.languageOptionText, language === lang && styles.languageOptionTextActive]}>
                  {lang}
                </Text>
                {language === lang && <Info size={16} color={Colors.primary} />}
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Main Settings Sections */}
        {sections.map((section, sectionIndex) => (
          <Animated.View key={section.title} entering={FadeInDown.delay(sectionIndex * 80).duration(300)}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <View style={styles.section}>
              {section.items.map((item, itemIndex) => (
                <TouchableOpacity
                  key={item.label}
                  style={[styles.item, itemIndex < section.items.length - 1 && styles.itemBorder]}
                  onPress={item.type === 'link' || item.type === 'action' || item.type === 'select' ? item.onPress : undefined}
                  disabled={item.type === 'toggle'}
                  activeOpacity={0.7}
                >
                  <item.icon size={20} color={Colors.text.secondary} />
                  <View style={styles.itemTextContainer}>
                    <Text style={styles.itemLabel}>{item.label}</Text>
                    {item.sublabel && <Text style={styles.itemSublabel}>{item.sublabel}</Text>}
                  </View>

                  {item.type === 'toggle' && (
                    <Switch
                      value={item.value}
                      onValueChange={item.onToggle}
                      trackColor={{ false: Colors.tertiary, true: Colors.primary }}
                      thumbColor={Colors.text.primary}
                    />
                  )}

                  {item.type === 'select' && item.selectedValue && (
                    <View style={styles.selectValue}>
                      <Text style={styles.selectValueText}>{item.selectedValue}</Text>
                      <ChevronRight size={16} color={Colors.text.muted} />
                    </View>
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
  itemTextContainer: { flex: 1 },
  itemLabel: {
    fontSize: FontSizes.md,
    color: Colors.text.primary,
    fontWeight: FontWeights.medium,
  },
  itemSublabel: {
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
    marginTop: 2,
  },
  selectValue: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  selectValueText: { fontSize: FontSizes.sm, color: Colors.text.muted },
  fontScaleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.md, minHeight: 52 },
  fontScaleButtons: { flexDirection: 'row', gap: Spacing.xs, marginLeft: 'auto' },
  fontScaleBtn: { width: 36, height: 36, borderRadius: BorderRadius.md, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  fontScaleBtnActive: { backgroundColor: Colors.primary },
  fontScaleBtnText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
  fontScaleBtnTextActive: { color: '#fff' },
  languageOptions: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xs, marginBottom: Spacing.sm, gap: 2 },
  languageOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm },
  languageOptionActive: { backgroundColor: 'rgba(229, 9, 20, 0.1)' },
  languageOptionText: { fontSize: FontSizes.md, color: Colors.text.secondary },
  languageOptionTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
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
