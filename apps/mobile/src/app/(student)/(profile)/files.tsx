/**
 * Classeur Screen - Document Library
 *
 * Lists all uploaded files for the student.
 * Allows viewing, sharing, and deleting documents.
 */

import { View, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  FileText,
  Image as ImageIcon,
  Trash2,
  FolderOpen,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useUserFiles, useIconColors, useThemeColors, type LibraryFile } from '@/hooks';
import { bgColors, shadows } from '@/lib/styles';
import { getTreaty, unwrap } from '@repo/api';
import { useQueryClient } from '@tanstack/react-query';
import { filesQueryKeys } from '@/hooks/useFiles';

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  return FileText;
}

function getSubjectLabel(subject: string | null): string | null {
  if (!subject) return null;
  const labels: Record<string, string> = {
    mathematiques: 'Maths',
    francais: 'Français',
    anglais: 'Anglais',
    histoire: 'Histoire',
    geographie: 'Géo',
    physique: 'Physique',
    chimie: 'Chimie',
    svt: 'SVT',
  };
  return labels[subject.toLowerCase()] ?? subject;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function FilesScreen() {
  const router = useRouter();
  const { confirm, info } = useConfirm();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const { files, isLoading, refetch } = useUserFiles();

  async function handleDelete(file: LibraryFile) {
    const confirmed = await confirm({
      title: 'Supprimer le fichier',
      message: `Supprimer "${file.fileName}" ? Cette action est irréversible.`,
      confirmLabel: 'Supprimer',
      variant: 'destructive',
    });
    if (confirmed) {
      try {
        unwrap(await getTreaty().api.upload.file({ fileId: file.id }).delete());
        void queryClient.invalidateQueries({ queryKey: filesQueryKeys.library() });
      } catch {
        info('Erreur', 'Impossible de supprimer le fichier');
      }
    }
  }

  function renderFile({ item }: { item: LibraryFile }) {
    const Icon = getFileIcon(item.mimeType);
    const subjectLabel = getSubjectLabel(item.subject);

    return (
      <Card style={shadows.sm} className="mb-2">
        <View className="flex-row items-center gap-3 p-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: bgColors.primary[10] }}
          >
            <Icon color={colors.primary} size={20} />
          </View>

          <View className="flex-1">
            <Text numberOfLines={1} className="font-medium">
              {item.fileName}
            </Text>
            <View className="flex-row items-center gap-2 mt-0.5">
              <Text variant="tiny" className="text-stone-500 dark:text-stone-400">
                {formatFileSize(item.sizeBytes)}
              </Text>
              <Text variant="tiny" className="text-stone-500 dark:text-stone-400">
                {formatDate(item.createdAt)}
              </Text>
              {subjectLabel && (
                <View
                  className="rounded-full px-1.5 py-0.5"
                  style={{ backgroundColor: bgColors.primary[10] }}
                >
                  <Text variant="tiny" className="text-blue-600 dark:text-blue-400 font-medium">
                    {subjectLabel}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            onPress={() => handleDelete(item)}
            className="h-8 w-8 items-center justify-center rounded-full"
            style={{ backgroundColor: bgColors.destructive[10] }}
            accessibilityLabel={`Supprimer ${item.fileName}`}
          >
            <Trash2 color={colors.destructive} size={16} />
          </TouchableOpacity>
        </View>
      </Card>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"
          accessibilityLabel="Retour"
        >
          <ArrowLeft color={iconColors.foreground} size={20} />
        </TouchableOpacity>
        <Text variant="large">Mon Classeur</Text>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <Text variant="muted">Chargement...</Text>
        </View>
      ) : files.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <View
            className="h-16 w-16 items-center justify-center rounded-full mb-4"
            style={{ backgroundColor: bgColors.primary[10] }}
          >
            <FolderOpen color={colors.primary} size={32} />
          </View>
          <Text variant="h3" className="text-center">
            Classeur vide
          </Text>
          <Text variant="muted" className="mt-2 text-center">
            Les fichiers que tu envoies dans le chat apparaitront ici automatiquement.
          </Text>
        </View>
      ) : (
        <FlashList
          data={files}
          keyExtractor={(item) => item.id}
          renderItem={renderFile}
          contentContainerStyle={{ padding: 16 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isLoading}

        />
      )}
    </SafeAreaView>
  );
}
