import { View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const progressVariants = cva('w-full overflow-hidden rounded-full bg-muted', {
  variants: {
    size: {
      sm: 'h-1',
      md: 'h-2',
      lg: 'h-3',
    },
  },
  defaultVariants: {
    size: 'md',
  },
});

const progressIndicatorVariants = cva('h-full rounded-full', {
  variants: {
    variant: {
      default: 'bg-primary',
      warning: 'bg-warning',
      destructive: 'bg-destructive',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

interface ProgressProps
  extends VariantProps<typeof progressVariants>,
    VariantProps<typeof progressIndicatorVariants> {
  value: number; // 0-100
  className?: string;
  style?: ViewStyle;
  animated?: boolean;
}

function Progress({
  value,
  size,
  variant,
  className,
  style,
  animated = true,
}: ProgressProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: animated
        ? withTiming(`${clampedValue}%`, {
            duration: 500,
            easing: Easing.out(Easing.ease),
          })
        : `${clampedValue}%`,
    };
  }, [clampedValue, animated]);

  return (
    <View className={cn(progressVariants({ size }), className)} style={style}>
      <Animated.View
        className={progressIndicatorVariants({ variant })}
        style={animatedStyle}
      />
    </View>
  );
}

export { Progress };
