import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import {
  Heart,
  Film,
  Clock,
  Bell,
  Search,
  Video,
  TrendingUp,
  Bookmark,
  WifiOff,
  AlertCircle,
  Users,
  ListVideo,
  MessageSquare,
  Zap,
  Play,
} from 'lucide-react-native';
import { Colors, Spacing, FontSizes, FontWeights, BorderRadius } from '@/constants/theme';
import { Button } from './Button';

type EmptyStateType =
  | 'favorites'
  | 'history'
  | 'notifications'
  | 'search'
  | 'videos'
  | 'shorts'
  | 'subscribers'
  | 'playlists'
  | 'posts'
  | 'comments'
  | 'continue-watching'
  | 'category'
  | 'network'
  | 'error'
  | 'custom';

interface EmptyStateProps {
  type: EmptyStateType;
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
}

const defaultContent: Record<EmptyStateType, { icon: React.ReactNode; title: string; message: string; actionLabel?: string }> = {
  favorites: {
    icon: <Heart size={64} color={Colors.primary} />,
    title: 'No favorites yet',
    message: "You haven't added any favorite videos yet.\nBrowse videos and tap the heart to save them here.",
    actionLabel: 'Browse Videos',
  },
  history: {
    icon: <Clock size={64} color={Colors.text.muted} />,
    title: 'No watch history',
    message: "You haven't watched any videos yet.\nStart exploring to build your watch history.",
    actionLabel: 'Start Watching',
  },
  notifications: {
    icon: <Bell size={64} color={Colors.text.muted} />,
    title: 'No notifications',
    message: "You're all caught up!\nNew notifications will appear here when videos are uploaded.",
  },
  search: {
    icon: <Search size={64} color={Colors.text.muted} />,
    title: 'No results found',
    message: "We couldn't find any videos matching your search.\nTry different keywords or browse categories.",
    actionLabel: 'Clear Search',
  },
  videos: {
    icon: <Film size={64} color={Colors.text.muted} />,
    title: 'No videos available',
    message: 'Check back later for new content.',
  },
  shorts: {
    icon: <Zap size={64} color={Colors.primary} />,
    title: 'No shorts yet',
    message: 'Short videos will appear here once uploaded.',
  },
  subscribers: {
    icon: <Users size={64} color={Colors.text.muted} />,
    title: 'No subscribers yet',
    message: 'Share your channel to start gaining subscribers.',
  },
  playlists: {
    icon: <ListVideo size={64} color={Colors.text.muted} />,
    title: 'No playlists yet',
    message: 'Create a playlist to organize your favorite videos.',
  },
  posts: {
    icon: <MessageSquare size={64} color={Colors.text.muted} />,
    title: 'No posts yet',
    message: 'Community posts will appear here once created.',
  },
  comments: {
    icon: <MessageSquare size={64} color={Colors.text.muted} />,
    title: 'No comments yet',
    message: 'Be the first to start the conversation.',
  },
  'continue-watching': {
    icon: <Play size={64} color={Colors.primary} />,
    title: 'Nothing to continue',
    message: "Start watching videos and we'll remember where you left off.",
    actionLabel: 'Find Something to Watch',
  },
  category: {
    icon: <Bookmark size={64} color={Colors.text.muted} />,
    title: 'No videos in this category',
    message: 'Check back later or explore other categories.',
    actionLabel: 'Browse All',
  },
  network: {
    icon: <WifiOff size={64} color={Colors.status.error} />,
    title: 'Connection lost',
    message: 'Please check your internet connection and try again.',
    actionLabel: 'Retry',
  },
  error: {
    icon: <AlertCircle size={64} color={Colors.status.error} />,
    title: 'Something went wrong',
    message: "We couldn't load this content. Please try again.",
    actionLabel: 'Try Again',
  },
  custom: {
    icon: null,
    title: '',
    message: '',
  },
};

export function EmptyState({
  type,
  title,
  message,
  icon,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}: EmptyStateProps) {
  const defaults = defaultContent[type];
  const displayTitle = title || defaults.title;
  const displayMessage = message || defaults.message;
  const displayIcon = icon || defaults.icon;
  const displayActionLabel = actionLabel || defaults.actionLabel;

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        {displayIcon}
      </View>
      <Text style={styles.title}>{displayTitle}</Text>
      <Text style={styles.message}>{displayMessage}</Text>
      {onAction && displayActionLabel && (
        <Button
          title={displayActionLabel}
          onPress={onAction}
          style={styles.primaryButton}
        />
      )}
      {onSecondaryAction && secondaryActionLabel && (
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSecondaryAction}
        >
          <Text style={styles.secondaryButtonText}>{secondaryActionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// Specialized empty states for common use cases
export function EmptyFavorites({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      type="favorites"
      onAction={onBrowse}
    />
  );
}

export function EmptyHistory({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      type="history"
      onAction={onBrowse}
    />
  );
}

export function EmptyNotifications() {
  return <EmptyState type="notifications" />;
}

export function EmptySearchResults({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      type="search"
      title={`No results for "${query}"`}
      message="Try checking your spelling or using different keywords."
      onAction={onClear}
      actionLabel="Clear Search"
    />
  );
}

export function EmptyContinueWatching({ onBrowse }: { onBrowse: () => void }) {
  return (
    <EmptyState
      type="continue-watching"
      onAction={onBrowse}
    />
  );
}

export function EmptyCategory({ categoryName, onBrowse }: { categoryName: string; onBrowse: () => void }) {
  return (
    <EmptyState
      type="category"
      title={`No ${categoryName} videos`}
      onAction={onBrowse}
    />
  );
}

export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      type="network"
      onAction={onRetry}
    />
  );
}

export function LoadingError({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      type="error"
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.xxl * 2,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xxl,
    backgroundColor: 'rgba(229, 9, 20, 0.08)',
  },
  title: {
    fontSize: FontSizes.xl,
    fontWeight: FontWeights.semibold,
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSizes.md,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  primaryButton: {
    minWidth: 180,
  },
  secondaryButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  secondaryButtonText: {
    fontSize: FontSizes.md,
    color: Colors.primary,
    fontWeight: FontWeights.medium,
  },
});
