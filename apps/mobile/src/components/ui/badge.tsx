import { View, type ViewStyle } from 'react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';

const badgeVariants = cva(
  'flex-row items-center justify-center rounded-full px-2.5 py-0.5',
  {
    variants: {
      variant: {
        default: 'bg-blue-600 dark:bg-blue-400',
        secondary: 'bg-slate-100 dark:bg-slate-800',
        destructive: 'bg-red-600 dark:bg-red-400',
        outline: 'border border-slate-200 dark:border-slate-700 bg-transparent',
        success: 'bg-emerald-600 dark:bg-emerald-400',
        warning: 'bg-amber-600 dark:bg-amber-400',
        // Subject colors - aligned with SUBJECT_COLORS
        french: 'bg-violet-500',
        mathematics: 'bg-blue-500',
        sciences: 'bg-green-500',
        physics: 'bg-cyan-500',
        history: 'bg-amber-500',
        english: 'bg-pink-500',
        philosophy: 'bg-purple-400',
        ses: 'bg-orange-500',
      },
      size: {
        sm: 'px-2 py-0.5',
        md: 'px-2.5 py-0.5',
        lg: 'px-3 py-1',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const badgeTextVariants = cva('font-medium', {
  variants: {
    variant: {
      default: 'text-white dark:text-slate-900',
      secondary: 'text-slate-800 dark:text-slate-100',
      destructive: 'text-white dark:text-slate-900',
      outline: 'text-slate-800 dark:text-slate-100',
      success: 'text-white dark:text-slate-900',
      warning: 'text-white dark:text-slate-900',
      // Subject text colors
      french: 'text-white',
      mathematics: 'text-white',
      sciences: 'text-white',
      physics: 'text-white',
      history: 'text-white',
      english: 'text-white',
      philosophy: 'text-white',
      ses: 'text-white',
    },
    size: {
      sm: 'text-xs',
      md: 'text-xs',
      lg: 'text-sm',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

interface BadgeProps extends VariantProps<typeof badgeVariants> {
  children: React.ReactNode;
  className?: string;
  style?: ViewStyle;
}

function Badge({ children, variant, size, className, style }: BadgeProps) {
  return (
    <View className={cn(badgeVariants({ variant, size }), className)} style={style}>
      {typeof children === 'string' ? (
        <Text className={badgeTextVariants({ variant, size })}>{children}</Text>
      ) : (
        children
      )}
    </View>
  );
}

export { Badge, badgeVariants, badgeTextVariants };
export type { BadgeProps };
