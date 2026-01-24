import { createContext, useContext } from 'react';
import {
  Pressable,
  ActivityIndicator,
  type PressableProps,
  type ViewStyle,
  type AccessibilityRole,
} from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';

const buttonVariants = cva(
  'flex-row items-center justify-center gap-2 rounded-md web:ring-offset-background web:transition-colors web:focus-visible:outline-none web:focus-visible:ring-2 web:focus-visible:ring-ring web:focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary active:opacity-90',
        destructive: 'bg-destructive active:opacity-90',
        outline: 'border border-input bg-background active:bg-accent',
        secondary: 'bg-secondary active:opacity-80',
        ghost: 'active:bg-accent',
        link: '',
      },
      size: {
        default: 'h-12 px-5 py-3',
        sm: 'h-9 px-3',
        lg: 'h-14 px-8',
        icon: 'h-12 w-12',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

const buttonTextVariants = cva('font-medium text-center', {
  variants: {
    variant: {
      default: 'text-primary-foreground',
      destructive: 'text-destructive-foreground',
      outline: 'text-foreground',
      secondary: 'text-secondary-foreground',
      ghost: 'text-foreground',
      link: 'text-primary underline',
    },
    size: {
      default: 'text-base',
      sm: 'text-sm',
      lg: 'text-lg',
      icon: 'text-base',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'default',
  },
});

// Context for passing text styles to children
const TextClassContext = createContext<string | undefined>(undefined);

export function useButtonTextClass() {
  return useContext(TextClassContext);
}

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
}

function Button({
  className,
  variant,
  size,
  children,
  disabled,
  isLoading,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  ...props
}: ButtonProps) {
  const textClass = buttonTextVariants({ variant, size });
  const isDisabled = disabled || isLoading;

  // Determine spinner color based on variant
  const spinnerColor =
    variant === 'outline' || variant === 'ghost' || variant === 'link'
      ? 'hsl(222.2, 47.4%, 11.2%)'
      : 'hsl(210, 40%, 98%)';

  return (
    <TextClassContext.Provider value={textClass}>
      <Pressable
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'opacity-50',
          className
        )}
        disabled={isDisabled}
        accessibilityRole={accessibilityRole}
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{
          disabled: isDisabled,
          busy: isLoading,
        }}
        {...props}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={spinnerColor} />
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
