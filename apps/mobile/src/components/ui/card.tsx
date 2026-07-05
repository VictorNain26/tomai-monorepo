import type React from 'react';
import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from './text';

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

function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn('flex-col gap-1.5 p-4', className)} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<typeof Text>) {
  return (
    <Text
      className={cn('font-heading text-lg font-semibold text-card-foreground', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<typeof Text>) {
  return <Text className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn('p-4 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps) {
  return <View className={cn('flex-row items-center p-4 pt-0', className)} {...props} />;
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
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardCompact,
  CardCompactContent,
};
