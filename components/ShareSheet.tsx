import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Clipboard, Platform, TextInput, ScrollView } from 'react-native';
import Animated, { FadeIn, SlideInDown, FadeOut } from 'react-native-reanimated';
import { X, Link2, Facebook, MessageCircle, Twitter, Send, Code, Check } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { useToast } from '@/components/Toast';

interface ShareSheetProps {
  visible: boolean;
  onClose: () => void;
  url: string;
  title?: string;
}

export function ShareSheet({ visible, onClose, url, title }: ShareSheetProps) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [showEmbed, setShowEmbed] = useState(false);

  const shareUrl = url || (typeof window !== 'undefined' ? window.location.href : '');

  const handleCopyLink = () => {
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        toast.success('Link copied', 'Paste it anywhere to share');
        setTimeout(() => setCopied(false), 2000);
      });
    } else {
      Clipboard.setString(shareUrl);
      setCopied(true);
      toast.success('Link copied');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShareTo = (platform: string) => {
    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedTitle = encodeURIComponent(title || 'Check this out on StreamWorld');
    let shareLink = '';

    switch (platform) {
      case 'facebook':
        shareLink = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
        break;
      case 'whatsapp':
        shareLink = `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`;
        break;
      case 'x':
        shareLink = `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`;
        break;
      case 'telegram':
        shareLink = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTitle}`;
        break;
    }

    if (Platform.OS === 'web' && shareLink) {
      window.open(shareLink, '_blank', 'width=600,height=500');
    }
  };

  const embedCode = `<iframe src="${shareUrl}" width="640" height="360" frameborder="0" allowfullscreen title="${title || 'StreamWorld Video'}"></iframe>`;

  const handleCopyEmbed = () => {
    if (Platform.OS === 'web' && navigator.clipboard) {
      navigator.clipboard.writeText(embedCode).then(() => {
        toast.success('Embed code copied', 'Paste it into your website HTML');
      });
    } else {
      Clipboard.setString(embedCode);
      toast.success('Embed code copied');
    }
  };

  const shareOptions = [
    { platform: 'copy', label: 'Copy Link', icon: copied ? Check : Link2, color: '#6366f1', onPress: handleCopyLink },
    { platform: 'facebook', label: 'Facebook', icon: Facebook, color: '#1877f2', onPress: () => handleShareTo('facebook') },
    { platform: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: '#25d366', onPress: () => handleShareTo('whatsapp') },
    { platform: 'x', label: 'X', icon: Twitter, color: '#000000', onPress: () => handleShareTo('x') },
    { platform: 'telegram', label: 'Telegram', icon: Send, color: '#0088cc', onPress: () => handleShareTo('telegram') },
    { platform: 'embed', label: 'Embed', icon: Code, color: '#f59e0b', onPress: () => setShowEmbed(true) },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
        <Animated.View entering={SlideInDown.duration(300)} style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Share</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={24} color={Colors.text.primary} />
            </TouchableOpacity>
          </View>

          {!showEmbed ? (
            <>
              <View style={styles.linkPreview}>
                <Link2 size={16} color={Colors.text.muted} />
                <Text style={styles.linkText} numberOfLines={1}>{shareUrl}</Text>
              </View>

              <View style={styles.optionsGrid}>
                {shareOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <TouchableOpacity
                      key={option.platform}
                      style={styles.optionItem}
                      onPress={option.onPress}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.optionIcon, { backgroundColor: option.color + '20' }]}>
                        <Icon size={24} color={option.color} />
                      </View>
                      <Text style={styles.optionLabel}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <View style={styles.embedContainer}>
              <Text style={styles.embedLabel}>Embed Code</Text>
              <TextInput
                style={styles.embedInput}
                value={embedCode}
                multiline
                editable={false}
                textAlignVertical="top"
              />
              <View style={styles.embedActions}>
                <TouchableOpacity style={styles.embedBtn} onPress={() => setShowEmbed(false)}>
                  <Text style={styles.embedBtnText}>Back</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.embedBtn, styles.embedBtnPrimary]} onPress={handleCopyEmbed}>
                  <Text style={styles.embedBtnPrimaryText}>Copy Embed Code</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingBottom: Spacing.xxl,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
  },
  linkPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.md,
  },
  linkText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text.muted,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  optionItem: {
    width: 72,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: FontSizes.xs,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  embedContainer: {
    padding: Spacing.lg,
  },
  embedLabel: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.text.secondary,
    marginBottom: Spacing.sm,
  },
  embedInput: {
    backgroundColor: Colors.tertiary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text.primary,
    fontSize: FontSizes.sm,
    fontFamily: Platform.OS === 'web' ? 'monospace' : undefined,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  embedActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  embedBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    backgroundColor: Colors.tertiary,
  },
  embedBtnPrimary: {
    backgroundColor: Colors.primary,
  },
  embedBtnText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.secondary,
  },
  embedBtnPrimaryText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
  },
});
