import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { Text, type TextProps } from './text';
import { shadows } from '@/lib/styles';

/**
 * TomAI Card Component - 2026
 *
 * Design principles:
 * - Generous padding for comfortable reading
 * - Modern rounded corners (12px)
 * - Subtle elevation for depth
 * - Clean visual hierarchy
 */

function Card({ className, style, ...props }: ViewProps) {
  return (
    <View
      className={cn('rounded-lg border border-border bg-card', className)}
      style={[shadows.sm, style]}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ViewProps) {
  return (
    <View className={cn('flex flex-col gap-2 p-5', className)} {...props} />
  );
}

function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      variant="h4"
      className={cn('leading-tight', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: TextProps) {
  return (
    <Text
      variant="muted"
      className={cn('leading-relaxed', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn('p-5 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn('flex-row items-center gap-3 p-5 pt-0', className)}
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
      className={cn('rounded-md border border-border bg-card', className)}
      style={[shadows.xs, style]}
      {...props}
    />
  );
}

function CardCompactContent({ className, ...props }: ViewProps) {
  return <View className={cn('p-4', className)} {...props} />;
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardCompact,
  CardCompactContent,
};
