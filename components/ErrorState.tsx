import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Wifi, Video, AlertCircle, RefreshCw } from 'lucide-react-native';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { getFriendlyError } from '@/lib/errors';

interface ErrorStateProps {
  error: any;
  onRetry?: () => void;
  retryLabel?: string;
}

export function ErrorState({ error, onRetry, retryLabel = 'Retry' }: ErrorStateProps) {
  const friendly = getFriendlyError(error);
  const Icon = friendly.icon === 'wifi' ? Wifi : friendly.icon === 'video' ? Video : AlertCircle;

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Icon size={48} color={Colors.text.muted} />
      </View>
      <Text style={styles.title}>{friendly.title}</Text>
      <Text style={styles.message}>{friendly.message}</Text>
      {onRetry && (
        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.8}>
          <RefreshCw size={18} color={Colors.text.primary} />
          <Text style={styles.retryText}>{retryLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

interface InlineErrorProps {
  error: any;
  onRetry?: () => void;
}

export function InlineError({ error, onRetry }: InlineErrorProps) {
  const friendly = getFriendlyError(error);

  return (
    <View style={styles.inlineContainer}>
      <AlertCircle size={20} color={Colors.status.error} />
      <Text style={styles.inlineText}>{friendly.message}</Text>
      {onRetry && (
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.inlineRetry}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: FontWeights.bold,
    color: Colors.text.primary,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSizes.md,
    color: Colors.text.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  retryText: {
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    color: '#fff',
  },
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  inlineText: {
    flex: 1,
    fontSize: FontSizes.sm,
    color: Colors.text.secondary,
  },
  inlineRetry: {
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
    color: Colors.primary,
  },
});
