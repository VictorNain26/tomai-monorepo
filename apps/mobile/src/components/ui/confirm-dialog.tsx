/**
 * ConfirmDialog - Bottom action sheet replacement for Alert.alert
 *
 * Anchored to the bottom of the screen (iOS action sheet style).
 * Uses native Modal slide animation for Expo Go compatibility.
 */

import { createContext, use, useState, useCallback, useRef, type ReactNode } from 'react';
import { View, Modal, Pressable, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './text';
import { shadows } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface DialogAction {
  label: string;
  variant?: 'default' | 'destructive' | 'outline' | 'ghost';
  onPress?: () => void | Promise<void>;
}

interface DialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'default' | 'destructive';
  /** Custom actions (overrides confirm/cancel) */
  actions?: DialogAction[];
}

interface ConfirmContextValue {
  confirm: (options: DialogOptions) => Promise<boolean>;
  /** Show a simple info dialog with OK button */
  info: (title: string, message: string) => void;
}

// ============================================================================
// CONTEXT
// ============================================================================

const ConfirmContext = createContext<ConfirmContextValue | undefined>(undefined);

export function useConfirm(): ConfirmContextValue {
  const ctx = use(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmDialogProvider');
  return ctx;
}

// ============================================================================
// ACTION ITEM
// ============================================================================

function ActionItem({
  action,
  onPress,
  isLoading,
  disabled,
}: {
  action: DialogAction;
  onPress: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}) {
  const isDestructive = action.variant === 'destructive';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || isLoading}
      activeOpacity={0.6}
      className="items-center py-3.5"
      style={disabled ? { opacity: 0.4 } : undefined}
    >
      <Text
        className={`text-base font-medium ${
          isDestructive
            ? 'text-red-500 dark:text-red-400'
            : 'text-stone-800 dark:text-stone-100'
        }`}
      >
        {isLoading ? '...' : action.label}
      </Text>
    </TouchableOpacity>
  );
}

// ============================================================================
// PROVIDER
// ============================================================================

interface DialogState {
  visible: boolean;
  options: DialogOptions;
}

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [dialog, setDialog] = useState<DialogState>({
    visible: false,
    options: { title: '' },
  });
  const [loading, setLoading] = useState(false);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: DialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setDialog({ visible: true, options });
    });
  }, []);

  const info = useCallback((title: string, message: string) => {
    setDialog({
      visible: true,
      options: { title, message, actions: [{ label: 'OK', variant: 'default' }] },
    });
    resolveRef.current = null;
  }, []);

  const close = useCallback((result: boolean) => {
    setDialog((prev) => ({ ...prev, visible: false }));
    setLoading(false);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  const handleAction = useCallback(async (action: DialogAction, result: boolean) => {
    if (action.onPress) {
      setLoading(true);
      try {
        await action.onPress();
      } finally {
        setLoading(false);
      }
    }
    close(result);
  }, [close]);

  const { options } = dialog;

  // Build actions list
  const actions: DialogAction[] = options.actions ?? [
    {
      label: options.confirmLabel ?? 'Confirmer',
      variant: options.variant === 'destructive' ? 'destructive' as const : 'default' as const,
    },
  ];

  return (
    <ConfirmContext value={{ confirm, info }}>
      {children}
      <Modal
        visible={dialog.visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => close(false)}
      >
        {/* Dimmed backdrop — tap to dismiss */}
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
          onPress={() => !loading && close(false)}
        />

        {/* Bottom sheet */}
        <View
          style={{
            paddingBottom: insets.bottom + 8,
            paddingHorizontal: 12,
            backgroundColor: 'transparent',
          }}
        >
          {/* Main card */}
          <View
            className="rounded-2xl bg-white dark:bg-stone-800 overflow-hidden"
            style={shadows.md}
          >
            {/* Header */}
            <View className="px-4 pt-4 pb-2">
              <Text className="text-center text-sm font-semibold text-foreground">
                {options.title}
              </Text>
              {options.message && (
                <Text className="mt-1 text-center text-xs text-muted-foreground leading-4">
                  {options.message}
                </Text>
              )}
            </View>

            {/* Separator */}
            <View className="mx-4 h-px bg-border" />

            {/* Actions */}
            {actions.map((action, i) => {
              const isLast = i === actions.length - 1;
              return (
                <View key={action.label}>
                  <ActionItem
                    action={action}
                    onPress={() => handleAction(action, isLast)}
                    isLoading={isLast && loading}
                    disabled={!isLast && loading}
                  />
                  {!isLast && <View className="mx-4 h-px bg-border" />}
                </View>
              );
            })}
          </View>

          {/* Cancel button — separate card */}
          <View
            className="mt-2 rounded-2xl bg-white dark:bg-stone-800 overflow-hidden"
            style={shadows.md}
          >
            <TouchableOpacity
              onPress={() => !loading && close(false)}
              activeOpacity={0.6}
              className="items-center py-3.5"
            >
              <Text className="text-base font-semibold text-primary">
                {options.cancelLabel ?? 'Annuler'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ConfirmContext>
  );
}
