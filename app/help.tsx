import React, { useState } from 'react';
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
  Phone,
  Mail,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  CreditCard,
  Play,
  User,
  Shield,
  AlertCircle,
} from 'lucide-react-native';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';

interface FAQItem {
  question: string;
  answer: string;
  icon: React.ReactNode;
}

const FAQ_DATA: FAQItem[] = [
  {
    question: 'How do I create an account?',
    answer: 'To create an account, tap the "Sign In" button on the profile tab, then select "Create Account". Fill in your email, password, and name to complete registration.',
    icon: <User size={20} color={Colors.primary} />,
  },
  {
    question: 'How do I watch a video?',
    answer: 'Simply tap on any video thumbnail from the home page, search results, or categories. Tap the "Play" button to start streaming.',
    icon: <Play size={20} color={Colors.primary} />,
  },
  {
    question: 'How do I add videos to favorites?',
    answer: 'While viewing a video, tap the heart icon to add it to your favorites. You can access all your favorites from the Favorites tab.',
    icon: <HelpCircle size={20} color={Colors.primary} />,
  },
  {
    question: 'What payment methods do you accept?',
    answer: 'We accept all major credit cards (Visa, MasterCard, American Express), debit cards, and mobile money payments through our secure payment gateway.',
    icon: <CreditCard size={20} color={Colors.primary} />,
  },
  {
    question: 'Is my personal information secure?',
    answer: 'Yes, we take data security seriously. All personal information is encrypted and stored securely. We never share your data with third parties without your consent.',
    icon: <Shield size={20} color={Colors.primary} />,
  },
  {
    question: 'How do I reset my password?',
    answer: 'Go to the login page and tap "Forgot Password". Enter your email address and we\'ll send you a secure link to reset your password.',
    icon: <AlertCircle size={20} color={Colors.primary} />,
  },
];

export default function HelpCenterScreen() {
  const router = useRouter();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

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
    const subject = 'StreamWorld Support Request';
    if (Platform.OS === 'web') {
      window.open(`mailto:${email}?subject=${encodeURIComponent(subject)}`, '_self');
    } else {
      Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}`);
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
        <Text style={styles.title}>Help Center</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Contact Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Contact Us</Text>
        <Text style={styles.sectionDescription}>
          Our support team is available 24/7 to help you with any questions or issues.
        </Text>

        <View style={styles.contactCards}>
          <TouchableOpacity style={styles.contactCard} onPress={handleCall}>
            <View style={styles.contactIcon}>
              <Phone size={24} color={Colors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Phone Support</Text>
              <Text style={styles.contactValue}>+234 906-317-6953</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.contactCard} onPress={handleEmail}>
            <View style={styles.contactIcon}>
              <Mail size={24} color={Colors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Email Support</Text>
              <Text style={styles.contactValue}>haskedolo@gmail.com</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.contactCard}>
            <View style={styles.contactIcon}>
              <MessageCircle size={24} color={Colors.primary} />
            </View>
            <View style={styles.contactInfo}>
              <Text style={styles.contactLabel}>Live Chat</Text>
              <Text style={styles.contactValue}>Coming Soon</Text>
            </View>
          </View>
        </View>
      </View>

      {/* FAQ Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
        <Text style={styles.sectionDescription}>
          Find quick answers to common questions below.
        </Text>

        <View style={styles.faqList}>
          {FAQ_DATA.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => toggleFAQ(index)}
              activeOpacity={0.8}
            >
              <View style={styles.faqHeader}>
                <View style={styles.faqIconContainer}>
                  {item.icon}
                </View>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                {expandedFAQ === index ? (
                  <ChevronUp size={20} color={Colors.text.muted} />
                ) : (
                  <ChevronDown size={20} color={Colors.text.muted} />
                )}
              </View>
              {expandedFAQ === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{item.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Need More Help Section */}
      <View style={styles.moreHelpSection}>
        <Text style={styles.moreHelpTitle}>Need More Help?</Text>
        <Text style={styles.moreHelpDescription}>
          Can't find what you're looking for? Our dedicated support team is here to help you 24/7.
        </Text>
        <View style={styles.contactInfoList}>
          <View style={styles.contactInfoRow}>
            <Phone size={16} color={Colors.text.secondary} />
            <Text style={styles.contactInfoText}>+234 906-317-6953</Text>
          </View>
          <View style={styles.contactInfoRow}>
            <Mail size={16} color={Colors.text.secondary} />
            <Text style={styles.contactInfoText}>haskedolo@gmail.com</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.emailButton} onPress={handleEmail}>
          <Mail size={18} color={Colors.text.primary} />
          <Text style={styles.emailButtonText}>Send us an email</Text>
        </TouchableOpacity>
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
  section: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  sectionDescription: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  contactCards: {
    gap: Spacing.md,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.primary}15`,
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
  faqList: {
    gap: Spacing.md,
  },
  faqItem: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  faqIconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    backgroundColor: `${Colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  faqQuestion: {
    flex: 1,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.medium,
    color: Colors.text.primary,
  },
  faqAnswer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  faqAnswerText: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    lineHeight: 22,
  },
  moreHelpSection: {
    backgroundColor: Colors.card,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
  },
  moreHelpTitle: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    marginBottom: Spacing.sm,
  },
  moreHelpDescription: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  contactInfoList: {
    width: '100%',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  contactInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  contactInfoText: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  emailButtonText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
  footer: {
    height: Spacing.xxl,
  },
});
