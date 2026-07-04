import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  Shield,
  Database,
  Lock,
  Cookie,
  ExternalLink,
  Users,
  Mail,
  Phone,
  Eye,
  FileText,
} from 'lucide-react-native';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  const handleCall = () => {
    const phoneNumber = '+2349063176953';
    if (Platform.OS === 'web') {
      window.open(`tel:${phoneNumber}`, '_self');
    } else {
      Linking.openURL(`tel:${phoneNumber}`);
    }
  };

  const handleEmail = () => {
    const email = 'haskedolo@gmail.com';
    if (Platform.OS === 'web') {
      window.open(`mailto:${email}`, '_self');
    } else {
      Linking.openURL(`mailto:${email}`);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ArrowLeft size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy Policy</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Shield size={40} color={Colors.primary} />
        </View>
        <Text style={styles.heroTitle}>Your Privacy Matters</Text>
        <Text style={styles.heroSubtitle}>
          Last updated: July 2024
        </Text>
      </View>

      {/* Introduction */}
      <View style={styles.section}>
        <Text style={styles.sectionContent}>
          At StreamFlix, we are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our streaming service.
        </Text>
      </View>

      {/* Information We Collect */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Database size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Information We Collect</Text>
        </View>
        <Text style={styles.sectionContent}>
          We collect information that you provide directly to us, including:
        </Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>- Name and email address</Text>
          <Text style={styles.listItem}>- Phone number (optional)</Text>
          <Text style={styles.listItem}>- Account credentials</Text>
          <Text style={styles.listItem}>- Payment information</Text>
          <Text style={styles.listItem}>- Viewing history and preferences</Text>
          <Text style={styles.listItem}>- Device and browser information</Text>
        </View>
      </View>

      {/* How We Use Your Information */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Eye size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>How We Use Your Information</Text>
        </View>
        <Text style={styles.sectionContent}>
          We use the information we collect to:
        </Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>- Provide, maintain, and improve our service</Text>
          <Text style={styles.listItem}>- Process transactions and send related information</Text>
          <Text style={styles.listItem}>- Personalize your viewing experience</Text>
          <Text style={styles.listItem}>- Send promotional communications (with your consent)</Text>
          <Text style={styles.listItem}>- Respond to comments, questions, and requests</Text>
          <Text style={styles.listItem}>- Monitor and analyze trends, usage, and activities</Text>
        </View>
      </View>

      {/* Data Security */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Lock size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Data Security</Text>
        </View>
        <Text style={styles.sectionContent}>
          We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet or electronic storage is completely secure. We cannot guarantee absolute security.
        </Text>
      </View>

      {/* Cookies */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Cookie size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Cookies and Tracking Technologies</Text>
        </View>
        <Text style={styles.sectionContent}>
          We use cookies and similar tracking technologies to:
        </Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>- Remember your preferences and settings</Text>
          <Text style={styles.listItem}>- Understand how you use our service</Text>
          <Text style={styles.listItem}>- Improve our service and user experience</Text>
          <Text style={styles.listItem}>- Provide personalized recommendations</Text>
        </View>
        <Text style={styles.sectionContent}>
          You can control cookies through your browser settings and other tools.
        </Text>
      </View>

      {/* Third-Party Services */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ExternalLink size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Third-Party Services</Text>
        </View>
        <Text style={styles.sectionContent}>
          We may share your information with third-party service providers who help us operate our business, including:
        </Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>- Payment processors</Text>
          <Text style={styles.listItem}>- Cloud storage providers</Text>
          <Text style={styles.listItem}>- Analytics services</Text>
          <Text style={styles.listItem}>- Customer support tools</Text>
        </View>
        <Text style={styles.sectionContent}>
          These providers are contractually obligated to keep your information confidential and secure.
        </Text>
      </View>

      {/* User Rights */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Users size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Your Rights</Text>
        </View>
        <Text style={styles.sectionContent}>
          You have the right to:
        </Text>
        <View style={styles.list}>
          <Text style={styles.listItem}>- Access your personal information</Text>
          <Text style={styles.listItem}>- Correct inaccurate data</Text>
          <Text style={styles.listItem}>- Delete your account and data</Text>
          <Text style={styles.listItem}>- Opt-out of marketing communications</Text>
          <Text style={styles.listItem}>- Request a copy of your data</Text>
          <Text style={styles.listItem}>- Restrict processing of your data</Text>
        </View>
      </View>

      {/* Contact Section */}
      <View style={styles.contactSection}>
        <View style={styles.contactHeader}>
          <FileText size={20} color={Colors.primary} />
          <Text style={styles.contactTitle}>Contact Us</Text>
        </View>
        <Text style={styles.contactDescription}>
          If you have questions or comments about this Privacy Policy, please contact us at:
        </Text>

        <View style={styles.contactCards}>
          <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
            <View style={styles.contactIcon}>
              <Phone size={22} color={Colors.text.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Phone</Text>
              <Text style={styles.contactValue}>+234 906-317-6953</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={handleEmail}>
            <View style={styles.contactIcon}>
              <Mail size={22} color={Colors.text.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email</Text>
              <Text style={styles.contactValue}>haskedolo@gmail.com</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          We reserve the right to modify this Privacy Policy at any time. We will notify users of any material changes by posting the new Privacy Policy on this page. Your continued use of our service after such modifications constitutes your acceptance of the updated policy.
        </Text>
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  backButton: {
    padding: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  placeholder: {
    width: 40,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontSize: FontSizes.xxl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.xs,
  },
  heroSubtitle: {
    fontSize: FontSizes.md,
    color: Colors.text.muted,
  },
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  sectionContent: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginBottom: Spacing.sm,
  },
  list: {
    marginBottom: Spacing.sm,
  },
  listItem: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 24,
    marginLeft: Spacing.sm,
  },
  contactSection: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  contactTitle: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  contactDescription: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  contactCards: {
    gap: Spacing.md,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
    marginBottom: Spacing.xs,
  },
  contactValue: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  disclaimer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  disclaimerText: {
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
    lineHeight: 20,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footer: {
    height: Spacing.xxl,
  },
});
