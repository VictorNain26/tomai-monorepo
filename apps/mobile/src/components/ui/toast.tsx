import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { View, Pressable, type ViewStyle } from 'react-native';
import Animated, {
  FadeInUp,
  FadeOutUp,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { Text } from './text';
import { shadows, bgColors, borderColors } from '@/lib/styles';

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

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

// Use inline styles to avoid NativeWind navigation context bug
const variantStyles: Record<ToastVariant, ViewStyle> = {
  default: {
    backgroundColor: 'hsl(0, 0%, 100%)',
    borderColor: 'hsl(214.3, 31.8%, 91.4%)',
  },
  success: {
    backgroundColor: bgColors.success[10],
    borderColor: borderColors.success[30],
  },
  error: {
    backgroundColor: bgColors.destructive[10],
    borderColor: borderColors.destructive[30],
  },
  warning: {
    backgroundColor: bgColors.warning[10],
    borderColor: borderColors.warning[30],
  },
  info: {
    backgroundColor: bgColors.primary[10],
    borderColor: borderColors.primary[30],
  },
};

const variantIcons: Record<ToastVariant, typeof CheckCircle> = {
  default: Info,
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

// Icon colors using semantic HSL values from global.css (matching exactly)
const variantColors: Record<ToastVariant, string> = {
  default: 'hsl(220, 9%, 46%)',   // --color-muted-foreground
  success: 'hsl(160, 84%, 39%)',  // --color-success
  error: 'hsl(0, 72%, 51%)',      // --color-destructive
  warning: 'hsl(32, 95%, 44%)',   // --color-warning
  info: 'hsl(221, 83%, 53%)',     // --color-primary
};

// Muted color for close button
const CLOSE_BUTTON_COLOR = 'hsl(220, 9%, 46%)'; // --color-muted-foreground

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
      className="mx-4 mb-2 flex-row items-start gap-3 rounded-xl border p-4"
      style={[variantStyles[variant], shadows.lg]}
    >
      <Icon size={20} color={iconColor} />
      <View className="flex-1">
        <Text className="font-semibold text-foreground">{toast.title}</Text>
        {toast.description && (
          <Text variant="small" className="text-muted-foreground mt-1">
            {toast.description}
          </Text>
        )}
      </View>
      <Pressable onPress={onDismiss} hitSlop={8}>
        <X size={18} color={CLOSE_BUTTON_COLOR} />
      </Pressable>
    </Animated.View>
  );
}

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
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
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
    </ToastContext.Provider>
  );
}

export type { Toast, ToastVariant };
