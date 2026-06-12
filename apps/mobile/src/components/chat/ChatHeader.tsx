import { View, TouchableOpacity } from 'react-native';
import { ChevronLeft, MoreVertical, FolderOpen } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { TomAvatar } from '@/components/common';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

interface ContextBadge {
  icon: React.ComponentType<{ color: string; size: number }>;
  label: string;
  color: string;
}

interface ChatHeaderProps {
  contextBadge: ContextBadge | null;
  currentSessionId: string | null;
  sessionFileCount: number;
  onBack: () => void;
  onOpenClasseur: () => void;
  onReset: () => void;
  onDelete: () => void;
}

export function ChatHeader({
  contextBadge,
  currentSessionId,
  sessionFileCount,
  onBack,
  onOpenClasseur,
  onReset,
  onDelete,
}: ChatHeaderProps) {
  const colors = useThemeColors();
  const { confirm } = useConfirm();

  return (
    <View className="flex-row items-center gap-2 border-b border-stone-200 dark:border-stone-700 px-2 py-3">
      {/* Back button */}
      <TouchableOpacity
        onPress={onBack}
        className="h-11 w-11 items-center justify-center rounded-full"
        accessibilityLabel="Retour aux conversations"
        accessibilityRole="button"
      >
        <ChevronLeft color={colors.foreground} size={22} />
      </TouchableOpacity>

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
              <FolderOpen color={colors.primary} size={14} />
              <Text variant="tiny" className="text-blue-600 dark:text-blue-400 font-medium">
                {sessionFileCount}
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => {
              void confirm({
                title: 'Options',
                actions: [
                  { label: 'Nouvelle conversation', variant: 'outline', onPress: onReset },
                  { label: 'Supprimer', variant: 'destructive', onPress: onDelete },
                ],
              });
            }}
            className="h-11 w-11 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"
            accessibilityLabel="Options de conversation"
            accessibilityHint="Ouvre les options de conversation"
            accessibilityRole="button"
          >
            <MoreVertical color={colors.mutedForeground} size={18} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
