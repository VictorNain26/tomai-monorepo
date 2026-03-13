import { View, TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks';

interface AddChildCardProps {
  onPress: () => void;
}

export function AddChildCard({ onPress }: AddChildCardProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View
        className="items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
        style={{ minHeight: 220 }}
      >
        <View
          className="mb-3 h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}
        >
          <Plus color={colors.primary} size={28} />
        </View>
        <Text className="font-semibold" style={{ color: colors.primary }}>
          Ajouter un enfant
        </Text>
      </View>
    </TouchableOpacity>
  );
}
