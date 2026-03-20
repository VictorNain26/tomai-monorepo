import { createContext, use } from 'react';
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
 * - h1-h4: Poppins (font-heading token) — page/section/card titles
 * - default/large/small/muted/tiny: Nunito Sans (font-sans token) — body text
 * - error/success: semantic feedback variants
 */

const textVariants = cva(
  cn('text-base text-stone-800 dark:text-stone-100 font-sans', Platform.select({ web: 'select-text' })),
  {
    variants: {
      variant: {
        default: '',
        // Headings - Poppins via font-heading token
        h1: 'text-3xl font-bold tracking-tight font-heading',
        h2: 'text-2xl font-bold tracking-tight font-heading',
        h3: 'text-xl font-semibold tracking-tight font-heading',
        h4: 'text-lg font-semibold tracking-tight font-heading',
        // Body variants
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium',
        muted: 'text-sm text-stone-600 dark:text-stone-400',
        reading: 'text-lg font-sans leading-relaxed',
        tiny: 'text-xs font-medium text-stone-600 dark:text-stone-400',
        // Semantic variants
        error: 'text-sm text-red-600 dark:text-red-400',
        success: 'text-sm text-emerald-600 dark:text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

/**
 * Get accessibility role based on text variant
 * Headings get 'header' role for screen readers
 */
function getAccessibilityRole(
  variant: TextProps['variant']
): AccessibilityRole | undefined {
  if (
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
  const textClass = use(TextClassContext);
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
