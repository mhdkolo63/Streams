import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  Flag,
  Info,
  Copyright,
  Gavel,
  FileWarning,
  CheckCircle2,
  XCircle,
  Clock,
  Bell,
} from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { useAuthGuard } from '@/hooks/useGlobalStore';

type Tab = 'copyright' | 'reports' | 'strikes' | 'warnings';

interface ReportItem {
  id: string;
  type: 'copyright' | 'report' | 'strike' | 'warning';
  title: string;
  description: string;
  status: 'active' | 'resolved' | 'pending' | 'dismissed';
  date: string;
  severity: 'low' | 'medium' | 'high';
}

export default function StudioCopyrightScreen() {
  useAuthGuard(true);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('copyright');

  const mockItems: Record<Tab, ReportItem[]> = {
    copyright: [
      { id: '1', type: 'copyright', title: 'No copyright claims', description: 'Your channel has no active copyright claims.', status: 'resolved', date: 'N/A', severity: 'low' },
    ],
    reports: [
      { id: '2', type: 'report', title: 'No community reports', description: 'No community guideline reports against your content.', status: 'resolved', date: 'N/A', severity: 'low' },
    ],
    strikes: [
      { id: '3', type: 'strike', title: 'No active strikes', description: 'Your channel is in good standing with no active strikes.', status: 'resolved', date: 'N/A', severity: 'low' },
    ],
    warnings: [
      { id: '4', type: 'warning', title: 'No warnings', description: 'You have no warnings on your account.', status: 'resolved', date: 'N/A', severity: 'low' },
    ],
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'copyright', label: 'Copyright', icon: Copyright },
    { key: 'reports', label: 'Reports', icon: Flag },
    { key: 'strikes', label: 'Strikes', icon: Gavel },
    { key: 'warnings', label: 'Warnings', icon: FileWarning },
  ];

  const getStatusIcon = (status: ReportItem['status']) => {
    switch (status) {
      case 'resolved': return <CheckCircle2 size={16} color={Colors.status.success} />;
      case 'active': return <XCircle size={16} color={Colors.status.error} />;
      case 'pending': return <Clock size={16} color={Colors.status.warning} />;
      case 'dismissed': return <Info size={16} color={Colors.text.muted} />;
    }
  };

  const getStatusColor = (status: ReportItem['status']) => {
    switch (status) {
      case 'resolved': return Colors.status.success;
      case 'active': return Colors.status.error;
      case 'pending': return Colors.status.warning;
      case 'dismissed': return Colors.text.muted;
    }
  };

  const items = mockItems[activeTab];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 } as any}>
            <ArrowLeft size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Copyright & Reports</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <tab.icon size={16} color={activeTab === tab.key ? Colors.primary : Colors.text.secondary} />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* Status Banner */}
          <Animated.View entering={FadeInDown.duration(300)} style={styles.statusBanner}>
            <View style={styles.statusIconWrap}>
              <Shield size={32} color={Colors.status.success} />
            </View>
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>Good Standing</Text>
              <Text style={styles.statusDesc}>Your channel has no active violations or claims.</Text>
            </View>
          </Animated.View>

          {/* Items */}
          {items.map((item, i) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(i * 50).duration(300)} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemIconWrap}>
                  {getStatusIcon(item.status)}
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDate}>{item.date}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.itemDesc}>{item.description}</Text>
            </Animated.View>
          ))}

          {/* Info Card */}
          <Animated.View entering={FadeInDown.delay(200).duration(300)} style={styles.infoCard}>
            <Info size={20} color={Colors.status.info} />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>How copyright works</Text>
              <Text style={styles.infoDesc}>
                Copyright claims can be filed when someone believes their content was used without permission. Three active strikes may result in channel termination.
              </Text>
            </View>
          </Animated.View>

          {/* Appeal Button */}
          <TouchableOpacity
            style={styles.appealBtn}
            onPress={() => Alert.alert('Submit Appeal', 'This feature will be available soon. Contact support for assistance.')}
          >
            <Bell size={16} color={Colors.text.secondary} />
            <Text style={styles.appealText}>Submit an Appeal</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: 50, paddingBottom: Spacing.md, gap: Spacing.md },
  backButton: { padding: Spacing.xs },
  headerTitle: { flex: 1, fontSize: FontSizes.xxl, fontWeight: FontWeights.bold, color: Colors.text.primary },
  tabs: { flexDirection: 'row', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.sm },
  tab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, backgroundColor: Colors.card },
  tabActive: { backgroundColor: 'rgba(229, 9, 20, 0.15)' },
  tabText: { fontSize: FontSizes.sm, color: Colors.text.secondary, fontWeight: FontWeights.medium },
  tabTextActive: { color: Colors.primary, fontWeight: FontWeights.semibold },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: 'rgba(34, 197, 94, 0.1)', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: 'rgba(34, 197, 94, 0.3)' },
  statusIconWrap: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(34, 197, 94, 0.15)', justifyContent: 'center', alignItems: 'center' },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: FontSizes.lg, fontWeight: FontWeights.bold, color: Colors.status.success },
  statusDesc: { fontSize: FontSizes.sm, color: Colors.text.secondary, marginTop: 2 },
  itemCard: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, borderWidth: 1, borderColor: Colors.border },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  itemIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.tertiary, justifyContent: 'center', alignItems: 'center' },
  itemInfo: { flex: 1 },
  itemTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.text.primary },
  itemDate: { fontSize: FontSizes.xs, color: Colors.text.muted, marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.sm },
  statusText: { fontSize: 10, fontWeight: FontWeights.semibold, textTransform: 'capitalize' },
  itemDesc: { fontSize: FontSizes.sm, color: Colors.text.secondary, lineHeight: 18 },
  infoCard: { flexDirection: 'row', gap: Spacing.md, backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.3)' },
  infoContent: { flex: 1 },
  infoTitle: { fontSize: FontSizes.md, fontWeight: FontWeights.semibold, color: Colors.status.info, marginBottom: 4 },
  infoDesc: { fontSize: FontSizes.sm, color: Colors.text.secondary, lineHeight: 18 },
  appealBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, backgroundColor: Colors.card, borderRadius: BorderRadius.lg, paddingVertical: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  appealText: { fontSize: FontSizes.md, color: Colors.text.secondary, fontWeight: FontWeights.semibold },
});
