import { View, type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  style?: ViewStyle;
  width?: DimensionValue;
  height?: DimensionValue;
  borderRadius?: number;
}

function Skeleton({
  className,
  style,
  width,
  height,
  borderRadius = 8,
}: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750 }),
        withTiming(0.5, { duration: 750 })
      ),
      -1,
      false
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={cn('bg-muted', className)}
      style={[
        {
          width,
          height,
          borderRadius,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Preset skeletons for common use cases
function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <View className={cn('gap-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={16}
          width={i === lines - 1 ? '70%' : '100%'}
          borderRadius={4}
        />
      ))}
    </View>
  );
}

function SkeletonAvatar({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Skeleton
      width={size}
      height={size}
      borderRadius={size / 2}
      className={className}
    />
  );
}

function SkeletonCard({ className }: { className?: string }) {
  return (
    <View
      className={cn(
        'rounded-xl border border-border bg-card p-4 gap-3',
        className
      )}
    >
      <View className="flex-row items-center gap-3">
        <SkeletonAvatar size={40} />
        <View className="flex-1 gap-2">
          <Skeleton height={16} width="60%" borderRadius={4} />
          <Skeleton height={12} width="40%" borderRadius={4} />
        </View>
      </View>
      <SkeletonText lines={2} />
    </View>
  );
}

function SkeletonButton({ className }: { className?: string }) {
  return <Skeleton height={48} width="100%" borderRadius={8} className={className} />;
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonCard,
  SkeletonButton,
};
export type { SkeletonProps };
