import { View, ActivityIndicator } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { colors } from '@/lib/styles';

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

export function LoadingScreen({
  message = 'Chargement...',
  className,
}: LoadingScreenProps) {
  return (
    <View
      className={cn(
        'flex-1 items-center justify-center bg-background',
        className
      )}
    >
      <ActivityIndicator size="large" color={colors.primary.DEFAULT} />
      {message && (
        <Text variant="muted" className="mt-4">
          {message}
        </Text>
      )}
    </View>
  );
}
