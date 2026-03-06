import { View, ActivityIndicator } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks/useThemeColors';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({
  message = 'Chargement...',
  className,
}: LoadingScreenProps) {
  const colors = useThemeColors();

  return (
    <View
      className={cn(
        'flex-1 items-center justify-center bg-slate-50 dark:bg-slate-900',
        className
      )}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      {message && (
        <Text variant="muted" className="mt-4">
          {message}
        </Text>
      )}
    </View>
  );
}
