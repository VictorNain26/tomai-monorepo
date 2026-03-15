import { forwardRef, useState } from 'react';
import { TextInput, View, Pressable, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * TomAI Input Component - 2026
 *
 * Design principles:
 * - Clear visual states (default, focus, error, success)
 * - Generous height for comfortable touch
 * - Semantic color feedback
 * - Accessible labels and hints
 */

const inputVariants = cva(
  'h-12 w-full rounded-lg border bg-stone-50 dark:bg-stone-900 px-4 py-3 text-base text-stone-800 dark:text-stone-100 web:ring-offset-stone-50 dark:web:ring-offset-stone-900 web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-stone-200 dark:border-stone-700 native:focus:border-blue-600 dark:native:focus:border-blue-400 web:focus-visible:ring-blue-600 dark:web:focus-visible:ring-blue-400',
        error:
          'border-red-600 dark:border-red-400 native:focus:border-red-600 dark:native:focus:border-red-400 web:focus-visible:ring-red-600 dark:web:focus-visible:ring-red-400',
        success:
          'border-emerald-600 dark:border-emerald-400 native:focus:border-emerald-600 dark:native:focus:border-emerald-400 web:focus-visible:ring-emerald-600 dark:web:focus-visible:ring-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface InputProps
  extends Omit<TextInputProps, 'editable'>,
    VariantProps<typeof inputVariants> {
  className?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Error message to display below input */
  errorMessage?: string;
  /** Label to display above input */
  label?: string;
  /** Helper text to display below input */
  helperText?: string;
  /** Accessibility label for screen readers */
  accessibilityLabel?: string;
  /** Accessibility hint describing the input */
  accessibilityHint?: string;
}

const Input = forwardRef<TextInput, InputProps>(
  (
    {
      className,
      variant,
      disabled,
      errorMessage,
      label,
      helperText,
      placeholderTextColor,
      accessibilityLabel,
      accessibilityHint,
      secureTextEntry,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const colors = useThemeColors();
    const isPasswordField = secureTextEntry === true;

    const effectiveVariant = errorMessage ? 'error' : variant;

    const defaultPlaceholderColor =
      effectiveVariant === 'error'
        ? colors.destructive
        : effectiveVariant === 'success'
          ? colors.success
          : colors.muted;

    return (
      <View className="w-full gap-1.5">
        {label && (
          <Text variant="small" className="text-stone-800 dark:text-stone-100">
            {label}
          </Text>
        )}
        <View className="relative">
          <TextInput
            ref={ref}
            className={cn(
              inputVariants({ variant: effectiveVariant }),
              isPasswordField && 'pr-12',
              className
            )}
            style={disabled ? { opacity: 0.5 } : undefined}
            editable={!disabled}
            secureTextEntry={isPasswordField && !showPassword}
            placeholderTextColor={placeholderTextColor ?? defaultPlaceholderColor}
            accessibilityLabel={accessibilityLabel ?? label}
            accessibilityHint={accessibilityHint}
            accessibilityState={{
              disabled,
            }}
            {...props}
          />
          {isPasswordField && (
            <Pressable
              onPress={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-0 h-12 w-10 items-center justify-center"
              accessibilityLabel={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
              accessibilityRole="button"
              hitSlop={8}
            >
              {showPassword ? (
                <EyeOff size={20} color={colors.muted} />
              ) : (
                <Eye size={20} color={colors.muted} />
              )}
            </Pressable>
          )}
        </View>
        {errorMessage && (
          <Text variant="small" className="text-red-600 dark:text-red-400">
            {errorMessage}
          </Text>
        )}
        {helperText && !errorMessage && (
          <Text variant="muted">{helperText}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
