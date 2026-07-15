import { type ViewStyle, type DimensionValue } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withRepeat,
  withTiming,
  useSharedValue,
  withSequence,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { motionDurations } from '@repo/tokens';
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
  borderRadius,
}: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    opacity.set(
      withRepeat(
        withSequence(
          withTiming(1, { duration: motionDurations.pulse }),
          withTiming(0.5, { duration: motionDurations.pulse })
        ),
        -1,
        false
      )
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className={cn('rounded-md bg-muted', className)}
      style={[
        { width, height },
        borderRadius !== undefined ? { borderRadius } : null,
        animatedStyle,
        style,
      ]}
    />
  );
}

export { Skeleton };
