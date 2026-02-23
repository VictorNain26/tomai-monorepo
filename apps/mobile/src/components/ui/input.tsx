import { forwardRef, useState } from 'react';
import { TextInput, View, Pressable, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';
import { colors } from '@/lib/styles';

/**
 * TomAI Input Component - 2026
 *
 * Design principles:
 * - Clear visual states (default, focus, error, success)
 * - Generous height for comfortable touch
 * - Semantic color feedback
 * - Accessible labels and hints
 */

// Semantic placeholder colors (matching new color palette)
const PLACEHOLDER_COLORS = {
  default: colors.muted.foreground, // #6B7280
  error: colors.destructive.DEFAULT, // #DC2626
  success: colors.success.DEFAULT, // #059669
} as const;

const inputVariants = cva(
  'h-12 w-full rounded-lg border bg-background px-4 py-3 text-base text-foreground web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-input native:focus:border-primary web:focus-visible:ring-primary',
        error:
          'border-destructive native:focus:border-destructive web:focus-visible:ring-destructive',
        success:
          'border-success native:focus:border-success web:focus-visible:ring-success',
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
    const isPasswordField = secureTextEntry === true;

    // Determine variant based on error message
    const effectiveVariant = errorMessage ? 'error' : variant;

    // Get placeholder color based on variant
    const defaultPlaceholderColor =
      effectiveVariant === 'error'
        ? PLACEHOLDER_COLORS.error
        : effectiveVariant === 'success'
          ? PLACEHOLDER_COLORS.success
          : PLACEHOLDER_COLORS.default;

    return (
      <View className="w-full gap-1.5">
        {label && (
          <Text variant="small" className="text-foreground">
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
                <EyeOff size={20} color={colors.muted.foreground} />
              ) : (
                <Eye size={20} color={colors.muted.foreground} />
              )}
            </Pressable>
          )}
        </View>
        {errorMessage && (
          <Text variant="small" className="text-destructive">
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
