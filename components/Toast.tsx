import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutUp,
  LinearTransition,
} from 'react-native-reanimated';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { Colors, BorderRadius, Spacing, FontSizes, FontWeights } from '@/constants/theme';

const { height } = Dimensions.get('window');

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: string;
  message: string;
  description?: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastContextType {
  show: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string, description?: string) => void;
  error: (message: string, description?: string) => void;
  warning: (message: string, description?: string) => void;
  info: (message: string, description?: string) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

function ToastItem({
  toast,
  onDismiss
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle size={20} color={Colors.status.success} />;
      case 'error':
        return <AlertCircle size={20} color={Colors.status.error} />;
      case 'warning':
        return <AlertTriangle size={20} color={Colors.status.warning} />;
      default:
        return <Info size={20} color={Colors.status.info} />;
    }
  };

  const getBorderColor = () => {
    switch (toast.type) {
      case 'success':
        return Colors.status.success;
      case 'error':
        return Colors.status.error;
      case 'warning':
        return Colors.status.warning;
      default:
        return Colors.status.info;
    }
  };

  const getBackgroundColor = () => {
    switch (toast.type) {
      case 'success':
        return 'rgba(34, 197, 94, 0.1)';
      case 'error':
        return 'rgba(239, 68, 68, 0.1)';
      case 'warning':
        return 'rgba(245, 158, 11, 0.1)';
      default:
        return 'rgba(59, 130, 246, 0.1)';
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration || 4000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  return (
    <Animated.View
      entering={SlideInDown.springify().damping(15).stiffness(150)}
      exiting={FadeOut.duration(200)}
      layout={LinearTransition.springify()}
      style={[
        styles.toast,
        {
          borderLeftColor: getBorderColor(),
          backgroundColor: Colors.card,
        },
      ]}
    >
      <View style={[styles.iconContainer, { backgroundColor: getBackgroundColor() }]}>
        {getIcon()}
      </View>
      <View style={styles.content}>
        <Text style={styles.message}>{toast.message}</Text>
        {toast.description && (
          <Text style={styles.description}>{toast.description}</Text>
        )}
        {toast.action && (
          <TouchableOpacity onPress={toast.action.onPress} style={styles.actionButton}>
            <Text style={styles.actionText}>{toast.action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity
        onPress={() => onDismiss(toast.id)}
        style={styles.closeButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <X size={16} color={Colors.text.muted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, message, type, duration }]);
  }, []);

  const success = useCallback((message: string, description?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, message, description, type: 'success', duration: 4000 }]);
  }, []);

  const error = useCallback((message: string, description?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, message, description, type: 'error', duration: 6000 }]);
  }, []);

  const warning = useCallback((message: string, description?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, message, description, type: 'warning', duration: 5000 }]);
  }, []);

  const info = useCallback((message: string, description?: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev.slice(-4), { id, message, description, type: 'info', duration: 4000 }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const contextValue = useMemo(() => ({ show, success, error, warning, info, dismiss, dismissAll }), [show, success, error, warning, info, dismiss, dismissAll]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {toasts.length > 0 && (
        <View style={styles.container} pointerEvents="box-none">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// Legacy export for backward compatibility
export function toast(message: string, type: ToastType = 'info', duration = 4000) {
  // This is kept for backward compatibility but will not work without the provider
  console.warn('toast() function called without ToastProvider. Use useToast() hook instead.');
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
    paddingTop: 50,
    zIndex: 9999,
    gap: Spacing.sm,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    gap: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  message: {
    color: Colors.text.primary,
    fontSize: FontSizes.md,
    fontWeight: FontWeights.semibold,
    marginBottom: 2,
  },
  description: {
    color: Colors.text.secondary,
    fontSize: FontSizes.sm,
    marginTop: 2,
    lineHeight: 18,
  },
  actionButton: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    backgroundColor: 'rgba(229, 9, 20, 0.1)',
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  actionText: {
    color: Colors.primary,
    fontSize: FontSizes.sm,
    fontWeight: FontWeights.semibold,
  },
  closeButton: {
    padding: Spacing.xs,
    marginTop: -Spacing.xs,
  },
});
