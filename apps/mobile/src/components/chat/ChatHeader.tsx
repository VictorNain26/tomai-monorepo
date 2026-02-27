import { View, TouchableOpacity, Alert } from 'react-native';
import { MoreVertical, FolderOpen } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { TomAvatar } from '@/components/common';
import { useIconColors } from '@/hooks';
import { bgColors, colors } from '@/lib/styles';

interface ContextBadge {
  icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  color: string;
}

interface ChatHeaderProps {
  contextBadge: ContextBadge | null;
  currentSessionId: string | null;
  sessionFileCount: number;
  onOpenClasseur: () => void;
  onReset: () => void;
  onDelete: () => void;
}

export function ChatHeader({
  contextBadge,
  currentSessionId,
  sessionFileCount,
  onOpenClasseur,
  onReset,
  onDelete,
}: ChatHeaderProps) {
  const iconColors = useIconColors();

  return (
    <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <TomAvatar size="sm" />
          <Text variant="large">Tom</Text>
        </View>
        {contextBadge && (
          <View className="mt-0.5 flex-row items-center gap-1 ml-10">
            <contextBadge.icon color={contextBadge.color} size={12} />
            <Text variant="tiny" style={{ color: contextBadge.color }}>
              {contextBadge.label}
            </Text>
          </View>
        )}
      </View>

      {currentSessionId && (
        <View className="flex-row items-center gap-2">
          {sessionFileCount > 0 && (
            <TouchableOpacity
              onPress={onOpenClasseur}
              className="flex-row items-center gap-1 rounded-full px-2.5 py-1.5"
              style={{ backgroundColor: bgColors.primary[10] }}
              accessibilityLabel={`${sessionFileCount} fichier(s) attaché(s)`}
            >
              <FolderOpen color={colors.primary.DEFAULT} size={14} />
              <Text variant="tiny" className="text-primary font-medium">
                {sessionFileCount}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              Alert.alert('Options', undefined, [
                { text: 'Nouvelle conversation', onPress: onReset },
                { text: 'Supprimer', onPress: onDelete, style: 'destructive' },
                { text: 'Annuler', style: 'cancel' },
              ]);
            }}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
            accessibilityLabel="Options de conversation"
            accessibilityRole="button"
          >
            <MoreVertical color={iconColors.muted} size={18} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
