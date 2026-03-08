import { useContext, useCallback } from 'react';
import {
  Pressable,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type AccessibilityRole,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text, TextClassContext } from './text';
import { useThemeColors } from '@/hooks/useThemeColors';
import { haptics } from '@/lib/haptics';

/**
 * TomAI Button Component - 2026
 *
 * Design principles:
 * - Generous padding for comfortable touch targets
 * - Modern rounded corners (not excessive)
 * - Clear visual hierarchy between variants
 * - Accessible focus states
 */

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-lg web:ring-offset-slate-50 dark:web:ring-offset-slate-900 web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-blue-600 dark:web:focus-visible:ring-blue-400 web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 dark:bg-blue-400',
        destructive: 'bg-red-600 dark:bg-red-400',
        outline: 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 active:bg-blue-50 dark:active:bg-blue-900',
        secondary: 'bg-slate-100 dark:bg-slate-800',
        ghost: 'active:bg-blue-50 dark:active:bg-blue-900',
        link: '',
        // New: Subtle variant for less prominent actions
        subtle: 'bg-blue-50 dark:bg-blue-900 active:bg-slate-100 dark:active:bg-slate-800',
      },
      size: {
        default: 'h-12 px-6 py-3',
        sm: 'h-11 px-4 py-2', // 44px minimum touch target (WCAG 2.1)
        lg: 'h-14 px-8 py-4',
        icon: 'h-12 w-12',
        'icon-sm': 'h-11 w-11', // 44px minimum touch target (was 40px)
        'icon-lg': 'h-14 w-14',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('font-semibold text-center', {
  variants: {
    variant: {
      default: 'text-white dark:text-slate-900',
      destructive: 'text-white dark:text-slate-900',
      outline: 'text-slate-800 dark:text-slate-100',
      secondary: 'text-slate-800 dark:text-slate-100',
      ghost: 'text-slate-800 dark:text-slate-100',
      link: 'text-blue-600 dark:text-blue-400 underline',
      subtle: 'text-blue-600 dark:text-blue-400',
    },
    size: {
      default: 'text-base',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: 'text-base',
      'icon-sm': 'text-sm',
      'icon-lg': 'text-lg',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

/**
 * Hook to access button text class from TextClassContext.
 * Use inside custom children of Button to get the correct text styling.
 */
export function useButtonTextClass() {
  return useContext(TextClassContext);
}

type HapticFeedback = 'none' | 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

interface ButtonProps
  extends Omit<PressableProps, 'style'>,
    VariantProps<typeof buttonVariants> {
  className?: string;
  style?: ViewStyle;
  /** Loading state - shows spinner and disables interaction */
  isLoading?: boolean;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Accessibility hint describing what happens on press */
  accessibilityHint?: string;
  /** Override accessibility role (default: button) */
  accessibilityRole?: AccessibilityRole;
  /**
   * Haptic feedback on press (default: 'light' for standard buttons, 'heavy' for destructive)
   * Set to 'none' to disable haptics
   */
  haptic?: HapticFeedback;
}

function Button({
  className,
  variant,
  size,
  style,
  children,
  disabled,
  isLoading,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  haptic,
  onPress,
  ...props
}: ButtonProps) {
  const colors = useThemeColors();
  const textClass = buttonTextVariants({ variant, size });
  const isDisabled = disabled || isLoading;

  // Determine haptic type based on variant (unless explicitly set)
  const hapticType: HapticFeedback = haptic ?? (variant === 'destructive' ? 'heavy' : 'light');

  // Wrap onPress to include haptic feedback
  const handlePress = useCallback(
    (e: Parameters<NonNullable<PressableProps['onPress']>>[0]) => {
      if (hapticType !== 'none') {
        switch (hapticType) {
          case 'light':
            haptics.light();
            break;
          case 'medium':
            haptics.medium();
            break;
          case 'heavy':
            haptics.heavy();
            break;
          case 'success':
            haptics.success();
            break;
          case 'error':
            haptics.error();
            break;
          case 'warning':
            haptics.warning();
            break;
        }
      }
      onPress?.(e);
    },
    [hapticType, onPress]
  );

  // Determine spinner color based on variant (using new color palette)
  const getSpinnerColor = () => {
    switch (variant) {
      case 'default':
        return colors.primaryForeground;
      case 'destructive':
        return colors.destructiveForeground;
      case 'outline':
      case 'ghost':
      case 'subtle':
      case 'link':
        return colors.primary;
      case 'secondary':
        return colors.foreground;
      default:
        return colors.primaryForeground;
    }
  };

  // Variants that need active opacity feedback
  const needsActiveOpacity =
    variant === 'default' ||
    variant === 'destructive' ||
    variant === 'secondary' ||
    variant === 'subtle';

  return (
    <TextClassContext.Provider value={textClass}>
      <Pressable
        className={cn(buttonVariants({ variant, size }), className)}
        style={({ pressed }) => [
          isDisabled && { opacity: 0.5 },
          pressed && needsActiveOpacity && { opacity: 0.9 },
          style,
        ]}
        disabled={isDisabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: isDisabled,
          busy: isLoading,
        }}
        onPress={handlePress}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={getSpinnerColor()} />
        ) : typeof children === 'string' ? (
          <Text className={textClass}>{children}</Text>
        ) : (
          children
        )}
      </Pressable>
    </TextClassContext.Provider>
  );
}

// ButtonText for use inside Button
function ButtonText({
  className,
  children,
  ...props
}: { className?: string; children: React.ReactNode }) {
  const textClass = useButtonTextClass();
  return (
    <Text className={cn(textClass, className)} {...props}>
      {children}
    </Text>
  );
}

export { Button, ButtonText, buttonVariants, buttonTextVariants };
export type { ButtonProps, HapticFeedback };
