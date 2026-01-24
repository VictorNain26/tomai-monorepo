import {
  Text as RNText,
  type TextProps as RNTextProps,
  type AccessibilityRole,
} from 'react-native';
import { Text as SlotText } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const textVariants = cva('text-base text-foreground web:select-text', {
  variants: {
    variant: {
      default: '',
      heading: 'text-3xl font-bold tracking-tight',
      h1: 'text-4xl font-extrabold tracking-tight',
      h2: 'text-3xl font-bold tracking-tight',
      h3: 'text-2xl font-semibold tracking-tight',
      h4: 'text-xl font-semibold tracking-tight',
      lead: 'text-xl text-muted-foreground',
      large: 'text-lg font-semibold',
      small: 'text-sm font-medium leading-none',
      muted: 'text-sm text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

/**
 * Get accessibility role based on text variant
 * Headings get 'header' role for screen readers
 */
function getAccessibilityRole(
  variant: TextProps['variant']
): AccessibilityRole | undefined {
  if (
    variant === 'heading' ||
    variant === 'h1' ||
    variant === 'h2' ||
    variant === 'h3' ||
    variant === 'h4'
  ) {
    return 'header';
  }
  return undefined;
}

type TextProps = RNTextProps &
  VariantProps<typeof textVariants> & {
    asChild?: boolean;
  };

function Text({
  className,
  variant,
  asChild = false,
  accessibilityRole,
  ...props
}: TextProps) {
  const Component = asChild ? SlotText : RNText;
  // Use provided accessibilityRole or derive from variant
  const derivedRole = accessibilityRole ?? getAccessibilityRole(variant);

  return (
    <Component
      className={cn(textVariants({ variant }), className)}
      accessibilityRole={derivedRole}
      {...props}
    />
  );
}

export { Text, textVariants };
export type { TextProps };
