import { View, type ViewStyle } from 'react-native';
import {
  MessageSquare,
  BookOpen,
  Link2Off,
  Search,
  type LucideIcon,
} from 'lucide-react-native';
import { cn } from '@/lib/utils';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

type EmptyStatePreset = 'no-chats' | 'no-decks' | 'pronote-disconnected' | 'no-results' | 'custom';

interface EmptyStateProps {
  preset?: EmptyStatePreset;
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  style?: ViewStyle;
}

const presets: Record<Exclude<EmptyStatePreset, 'custom'>, {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel: string;
}> = {
  'no-chats': {
    icon: MessageSquare,
    title: 'Pas encore de conversation',
    description: 'Pose ta première question à Tom !',
    actionLabel: 'Commencer',
  },
  'no-decks': {
    icon: BookOpen,
    title: 'Aucun deck de révision',
    description: "Crée ton premier deck avec l'aide de l'IA",
    actionLabel: 'Créer un deck',
  },
  'pronote-disconnected': {
    icon: Link2Off,
    title: 'Pronote non connecté',
    description: 'Connecte-toi pour voir tes devoirs et notes',
    actionLabel: 'Se connecter',
  },
  'no-results': {
    icon: Search,
    title: 'Aucun résultat',
    description: 'Essaie avec d\'autres termes de recherche',
    actionLabel: 'Réinitialiser',
  },
};

export function EmptyState({
  preset = 'custom',
  icon: CustomIcon,
  title: customTitle,
  description: customDescription,
  actionLabel: customActionLabel,
  onAction,
  className,
  style,
}: EmptyStateProps) {
  const config = preset !== 'custom' ? presets[preset] : null;

  const Icon = CustomIcon ?? config?.icon ?? MessageSquare;
  const title = customTitle ?? config?.title ?? 'Rien à afficher';
  const description = customDescription ?? config?.description ?? '';
  const actionLabel = customActionLabel ?? config?.actionLabel;

  return (
    <View
      className={cn('flex-1 items-center justify-center p-6', className)}
      style={style}
    >
      <View className="items-center max-w-xs">
        <View className="h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
          <Icon size={32} color="#94A3B8" />
        </View>

        <Text variant="h3" className="text-center mb-2">
          {title}
        </Text>

        {description && (
          <Text variant="muted" className="text-center mb-6">
            {description}
          </Text>
        )}

        {actionLabel && onAction && (
          <Button onPress={onAction}>
            <Text className="text-primary-foreground font-semibold">
              {actionLabel}
            </Text>
          </Button>
        )}
      </View>
    </View>
  );
}
