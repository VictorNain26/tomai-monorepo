import { createContext, use, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { View, Pressable, Text as RNText, type ViewStyle, type TextStyle } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { shadows } from '@/lib/styles';
import { haptics } from '@/lib/haptics';

type ToastVariant = 'default' | 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

/**
 * useToast hook with convenience methods
 *
 * Usage:
 *   const toast = useToast();
 *   toast.success('Enfant cree !');
 *   toast.error('Impossible de se connecter');
 *   toast.warning('Session expiree bientot');
 *   toast.info('Mise a jour disponible');
 */
export function useToast() {
  const context = use(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  const { addToast, removeToast, toasts } = context;

  return {
    toasts,
    addToast,
    removeToast,

    /** Show success toast */
    success: (title: string, description?: string) =>
      addToast({ title, description, variant: 'success' }),

    /** Show error toast */
    error: (title: string, description?: string) =>
      addToast({ title, description, variant: 'error' }),

    /** Show warning toast */
    warning: (title: string, description?: string) =>
      addToast({ title, description, variant: 'warning' }),

    /** Show info toast */
    info: (title: string, description?: string) =>
      addToast({ title, description, variant: 'info' }),
  };
}

// ============================================================================
// Toast Item - Fully inline styles (self-contained, no NativeWind dependency)
// This allows ToastProvider to live in the root layout above Slot.
// ============================================================================

const variantStyles: Record<ToastVariant, ViewStyle> = {
  default: {
    backgroundColor: 'hsl(0, 0%, 100%)',
    borderColor: 'hsl(214.3, 31.8%, 91.4%)',
  },
  success: {
    backgroundColor: 'hsl(160, 84%, 96%)',
    borderColor: 'hsl(160, 84%, 80%)',
  },
  error: {
    backgroundColor: 'hsl(0, 72%, 96%)',
    borderColor: 'hsl(0, 72%, 82%)',
  },
  warning: {
    backgroundColor: 'hsl(32, 95%, 95%)',
    borderColor: 'hsl(32, 95%, 78%)',
  },
  info: {
    backgroundColor: 'hsl(221, 83%, 96%)',
    borderColor: 'hsl(221, 83%, 82%)',
  },
};

const variantIcons: Record<ToastVariant, typeof CheckCircle> = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const variantColors: Record<ToastVariant, string> = {
  default: 'hsl(220, 9%, 46%)',
  success: 'hsl(160, 84%, 39%)',
  error: 'hsl(0, 72%, 51%)',
  warning: 'hsl(32, 95%, 44%)',
  info: 'hsl(221, 83%, 53%)',
};

const CLOSE_BUTTON_COLOR = 'hsl(220, 9%, 46%)';
const TEXT_COLOR = 'hsl(222.2, 47.4%, 11.2%)';
const MUTED_TEXT_COLOR = 'hsl(220, 9%, 46%)';

const toastItemStyle: ViewStyle = {
  marginHorizontal: 16,
  marginBottom: 8,
  flexDirection: 'row',
  alignItems: 'flex-start',
  gap: 12,
  borderRadius: 12,
  borderWidth: 1,
  padding: 16,
};

const titleStyle: TextStyle = {
  fontWeight: '600',
  fontSize: 15,
  color: TEXT_COLOR,
};

const descriptionStyle: TextStyle = {
  fontSize: 13,
  color: MUTED_TEXT_COLOR,
  marginTop: 4,
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: () => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const variant = toast.variant ?? 'default';
  const Icon = variantIcons[variant];
  const iconColor = variantColors[variant];

  return (
    <Animated.View
      entering={FadeInUp.duration(200)}
      exiting={FadeOutUp.duration(200)}
      layout={Layout.springify()}
      style={[toastItemStyle, variantStyles[variant], shadows.lg]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Icon size={20} color={iconColor} />
      <View style={{ flex: 1 }}>
        <RNText style={titleStyle}>{toast.title}</RNText>
        {toast.description && (
          <RNText style={descriptionStyle}>{toast.description}</RNText>
        )}
      </View>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <X size={18} color={CLOSE_BUTTON_COLOR} />
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// Toast Provider - Global context, goes in root _layout.tsx
// ============================================================================

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const insets = useSafeAreaInsets();
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup all timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutsRef.current;
    return () => {
      timeouts.forEach((timeout) => clearTimeout(timeout));
      timeouts.clear();
    };
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = { ...toast, id };

    // Trigger haptic feedback based on variant
    const variant = toast.variant ?? 'default';
    switch (variant) {
      case 'success':
        haptics.success();
        break;
      case 'error':
        haptics.error();
        break;
      case 'warning':
        haptics.warning();
        break;
      default:
        haptics.light();
    }

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss with cleanup tracking
    const duration = toast.duration ?? 4000;
    const timeout = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      timeoutsRef.current.delete(id);
    }, duration);
    timeoutsRef.current.set(id, timeout);
  }, []);

  const removeToast = useCallback((id: string) => {
    // Clear timeout if toast is manually dismissed
    const timeout = timeoutsRef.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutsRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext value={{ toasts, addToast, removeToast }}>
      {children}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: insets.top + 8,
          zIndex: 50,
        }}
        pointerEvents="box-none"
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            onDismiss={() => removeToast(t.id)}
          />
        ))}
      </View>
    </ToastContext>
  );
}

