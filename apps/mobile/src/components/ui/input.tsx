import { forwardRef } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';

// Semantic placeholder colors (matching CSS variables from global.css)
const PLACEHOLDER_COLORS = {
  default: 'hsl(215.4, 16.3%, 46.9%)', // muted-foreground
  error: 'hsl(0, 84.2%, 60.2%)', // destructive
  success: 'hsl(142, 76%, 36%)', // success
} as const;

const inputVariants = cva(
  'h-12 w-full rounded-md border bg-background px-3 py-2 text-base text-foreground web:ring-offset-background web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-input native:focus:border-ring web:focus-visible:ring-ring',
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
      placeholderTextColor,
      accessibilityLabel,
      accessibilityHint,
      ...props
    },
    ref
  ) => {
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
      <View className="w-full">
        <TextInput
          ref={ref}
          className={cn(
            inputVariants({ variant: effectiveVariant }),
            disabled && 'opacity-50',
            className
          )}
          editable={!disabled}
          placeholderTextColor={placeholderTextColor ?? defaultPlaceholderColor}
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
          accessibilityState={{
            disabled,
          }}
          {...props}
        />
        {errorMessage && (
          <Text className="mt-1 text-sm text-destructive">{errorMessage}</Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';

export { Input, inputVariants };
