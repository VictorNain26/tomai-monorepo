import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { bgColors } from '@/lib/styles';
import { useThemeColors } from '@/hooks';

interface ProfileCardProps {
  name: string;
  subtitle?: string;
  variant?: 'child' | 'parent';
  onPress: () => void;
}

export function ProfileCard({ name, subtitle, variant = 'child', onPress }: ProfileCardProps) {
  const colors = useThemeColors();
  const initial = name.charAt(0).toUpperCase();
  const isParent = variant === 'parent';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="items-center gap-2"
      accessibilityLabel={`Profil ${name}`}
      accessibilityRole="button"
    >
      <View
        className={`h-20 w-20 items-center justify-center rounded-2xl ${
          isParent ? 'border-2 border-primary' : ''
        }`}
        style={{ backgroundColor: isParent ? bgColors.primary[10] : bgColors.muted[30] }}
      >
        <Text
          className="text-3xl font-bold"
          style={{ color: isParent ? colors.primary : colors.foreground }}
        >
          {initial}
        </Text>
      </View>
      <Text className="font-medium">{name}</Text>
      {subtitle && <Text variant="tiny">{subtitle}</Text>}
    </TouchableOpacity>
  );
}
