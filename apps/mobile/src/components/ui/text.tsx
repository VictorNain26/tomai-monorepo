import {
  Text as RNText,
  type TextProps as RNTextProps,
  type AccessibilityRole,
} from 'react-native';
import { Text as SlotText } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * TomAI Text Component - 2026
 *
 * Typography scale:
 * - h1: 32px bold - Page titles
 * - h2: 24px bold - Section headers
 * - h3: 20px semibold - Card titles
 * - h4: 18px semibold - Subsection titles
 * - large: 18px semibold - Emphasis
 * - default: 16px regular - Body text
 * - small: 14px medium - Labels, captions
 * - muted: 14px regular - Secondary text
 * - tiny: 12px medium - Badges, timestamps
 */

const textVariants = cva('text-base text-foreground web:select-text', {
  variants: {
    variant: {
      default: '',
      // Headings - Plus Jakarta Sans style (simulated with font weight)
      h1: 'text-3xl font-bold tracking-tight',
      h2: 'text-2xl font-bold tracking-tight',
      h3: 'text-xl font-semibold tracking-tight',
      h4: 'text-lg font-semibold tracking-tight',
      // Legacy heading alias
      heading: 'text-2xl font-bold tracking-tight',
      // Body variants
      large: 'text-lg font-semibold',
      lead: 'text-lg text-muted-foreground',
      small: 'text-sm font-medium',
      muted: 'text-sm text-muted-foreground',
      tiny: 'text-xs font-medium text-muted-foreground',
      // Semantic variants
      label: 'text-sm font-medium text-foreground',
      caption: 'text-xs text-muted-foreground',
      error: 'text-sm text-destructive',
      success: 'text-sm text-success',
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
