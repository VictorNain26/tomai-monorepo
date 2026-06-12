import { useState } from 'react';
import { View, Image, type ViewStyle } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';

const avatarVariants = cva(
  'relative flex items-center justify-center overflow-hidden rounded-full bg-muted',
  {
    variants: {
      size: {
        sm: 'h-8 w-8',
        md: 'h-10 w-10',
        lg: 'h-12 w-12',
        xl: 'h-16 w-16',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  }
);

const avatarTextVariants = cva('font-semibold text-muted-foreground', {
  variants: {
    size: {
      sm: 'text-xs',
      md: 'text-sm',
      lg: 'text-base',
      xl: 'text-lg',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

interface AvatarProps extends VariantProps<typeof avatarVariants> {
  src?: string;
  fallback?: string;
  className?: string;
  style?: ViewStyle;
}

function Avatar({ src, fallback, size, className, style }: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const initials = fallback
    ? fallback
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  const showFallback = !src || imageError;

  return (
    <View className={cn(avatarVariants({ size }), className)} style={style}>
      {showFallback ? (
        <Text className={avatarTextVariants({ size })}>{initials}</Text>
      ) : (
        <Image
          source={{ uri: src }}
          className="h-full w-full"
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      )}
    </View>
  );
}

export { Avatar, avatarVariants };
export type { AvatarProps };
