import { createContext, useContext } from 'react';
import {
  Text as RNText,
  Platform,
  type TextProps as RNTextProps,
  type AccessibilityRole,
} from 'react-native';
import { Text as SlotText } from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

/**
 * TextClassContext - allows parent components (e.g. Button) to pass
 * text styles to child Text components via React context.
 * Follows the React Native Reusables pattern.
 */
const TextClassContext = createContext<string | undefined>(undefined);

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

const textVariants = cva(
  cn('text-base text-slate-800 dark:text-slate-100', Platform.select({ web: 'select-text' })),
  {
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
      lead: 'text-lg text-slate-500 dark:text-slate-400',
      small: 'text-sm font-medium',
      muted: 'text-sm text-slate-500 dark:text-slate-400',
      tiny: 'text-xs font-medium text-slate-500 dark:text-slate-400',
      // Semantic variants
      label: 'text-sm font-medium text-slate-800 dark:text-slate-100',
      caption: 'text-xs text-slate-500 dark:text-slate-400',
      error: 'text-sm text-red-600 dark:text-red-400',
      success: 'text-sm text-emerald-600 dark:text-emerald-400',
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

/**
 * aria-level for heading hierarchy (WCAG 1.3.1)
 * Follows the React Native Reusables pattern for proper heading semantics.
 */
const ARIA_LEVEL: Partial<Record<NonNullable<TextProps['variant']>, string>> = {
  h1: '1',
  h2: '2',
  h3: '3',
  h4: '4',
};

function Text({
  className,
  variant,
  asChild = false,
  accessibilityRole,
  ...props
}: TextProps) {
  const textClass = useContext(TextClassContext);
  const Component = asChild ? SlotText : RNText;
  // Use provided accessibilityRole or derive from variant
  const derivedRole = accessibilityRole ?? getAccessibilityRole(variant);

  return (
    <Component
      className={cn(textVariants({ variant }), textClass, className)}
      accessibilityRole={derivedRole}
      aria-level={variant ? ARIA_LEVEL[variant] : undefined}
      {...props}
    />
  );
}

export { Text, TextClassContext, textVariants };
export type { TextProps };
