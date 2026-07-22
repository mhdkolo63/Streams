import { Colors } from '@/constants/theme';

export interface FriendlyError {
  title: string;
  message: string;
  icon: 'wifi' | 'video' | 'generic';
}

export function getFriendlyError(error: any): FriendlyError {
  if (!error) {
    return { title: 'Something went wrong', message: 'Please try again in a moment.', icon: 'generic' };
  }

  const errorStr = typeof error === 'string' ? error : error.message || error.toString?.() || '';
  const lower = errorStr.toLowerCase();

  if (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('timeout') ||
    lower.includes('connection') ||
    lower.includes('internet') ||
    lower.includes('failed to fetch')
  ) {
    return {
      title: 'No Internet',
      message: 'Check your connection and try again.',
      icon: 'wifi',
    };
  }

  if (
    lower.includes('not found') ||
    lower.includes('unavailable') ||
    lower.includes('removed') ||
    lower.includes('does not exist')
  ) {
    return {
      title: 'Video unavailable',
      message: 'This content may have been removed or is not yet available.',
      icon: 'video',
    };
  }

  if (lower.includes('permission') || lower.includes('unauthorized') || lower.includes('forbidden')) {
    return {
      title: 'Access restricted',
      message: 'You may need to sign in to view this content.',
      icon: 'generic',
    };
  }

  return {
    title: 'Something went wrong',
    message: 'An unexpected error occurred. Please try again.',
    icon: 'generic',
  };
}

export const errorColors = {
  primary: Colors.primary,
  text: Colors.text,
  card: Colors.card,
  background: Colors.background,
  border: Colors.border,
};
