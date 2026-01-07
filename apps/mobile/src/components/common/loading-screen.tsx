import { View, ActivityIndicator } from 'react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';

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
      <ActivityIndicator size="large" color="#3B82F6" />
      {message && (
        <Text variant="muted" className="mt-4">
          {message}
        </Text>
      )}
    </View>
  );
}
