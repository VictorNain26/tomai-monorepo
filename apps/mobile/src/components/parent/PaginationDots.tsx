import { View } from 'react-native';
import { useThemeColors } from '@/hooks';

interface PaginationDotsProps {
  total: number;
  activeIndex: number;
}

export function PaginationDots({ total, activeIndex }: PaginationDotsProps) {
  const colors = useThemeColors();

  if (total <= 1) return null;

  return (
    <View className="flex-row items-center justify-center gap-1.5 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="rounded-full"
          style={{
            width: i === activeIndex ? 20 : 6,
            height: 6,
            backgroundColor: i === activeIndex ? colors.primary : 'rgba(107, 114, 128, 0.3)',
          }}
        />
      ))}
    </View>
  );
}
