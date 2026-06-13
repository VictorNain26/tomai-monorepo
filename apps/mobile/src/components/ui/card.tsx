import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';

/**
 * TomAI Card Component - 2026
 *
 * Borderless design: depth via bg-card contrast (real in dark mode; in light
 * mode card ≈ background, separation comes from elevation/shadow).
 * No visible borders — clean, modern look.
 */

function Card({ className, style, ...props }: ViewProps) {
  return (
    <View
      className={cn('rounded-2xl bg-card', className)}
      style={style}
      {...props}
    />
  );
}

/**
 * Compact card variant for lists and dense layouts
 */
function CardCompact({ className, style, ...props }: ViewProps) {
  return (
    <View
      className={cn('rounded-xl bg-card', className)}
      style={style}
      {...props}
    />
  );
}

function CardCompactContent({ className, ...props }: ViewProps) {
  return <View className={cn('p-4', className)} {...props} />;
}

export {
  Card,
  CardCompact,
  CardCompactContent,
};
