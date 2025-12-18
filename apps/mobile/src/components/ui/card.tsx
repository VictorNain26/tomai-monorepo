import { View, type ViewProps } from 'react-native';
import { cn } from '@/lib/utils';
import { Text, type TextProps } from './text';

function Card({ className, ...props }: ViewProps) {
  return (
    <View
      className={cn(
        'rounded-lg border border-border bg-card shadow-sm',
        className
      )}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: ViewProps) {
  return <View className={cn('flex flex-col gap-1.5 p-6', className)} {...props} />;
}

function CardTitle({ className, ...props }: TextProps) {
  return (
    <Text
      variant="h3"
      className={cn('leading-none', className)}
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: TextProps) {
  return <Text variant="muted" className={className} {...props} />;
}

function CardContent({ className, ...props }: ViewProps) {
  return <View className={cn('p-6 pt-0', className)} {...props} />;
}

function CardFooter({ className, ...props }: ViewProps) {
  return (
    <View className={cn('flex-row items-center p-6 pt-0', className)} {...props} />
  );
}

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
