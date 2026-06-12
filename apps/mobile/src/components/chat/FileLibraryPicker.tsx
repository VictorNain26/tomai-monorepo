/**
 * FileLibraryPicker - Sélecteur de fichiers depuis le classeur
 *
 * Modal qui liste les fichiers du classeur et permet de les
 * attacher/détacher d'une session de chat.
 */

import { View, TouchableOpacity, Modal } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import {
  X,
  FileText,
  Image as ImageIcon,
  Check,
  FolderOpen,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import {
  useUserFiles,
  useSessionFiles,
  useAttachFile,
  useDetachFile,
  useThemeColors,
  type LibraryFile,
} from '@/hooks';
import { bgColors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface FileLibraryPickerProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return ImageIcon;
  return FileText;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function FileLibraryPicker({ visible, onClose, sessionId }: FileLibraryPickerProps) {
  const colors = useThemeColors();
  const { files: libraryFiles, isLoading: isLoadingLibrary } = useUserFiles();
  const { files: sessionFilesList } = useSessionFiles(sessionId);
  const attachMutation = useAttachFile();
  const detachMutation = useDetachFile();

  const attachedIds = new Set(sessionFilesList.map(f => f.id));
  const isMaxReached = sessionFilesList.length >= 10;

  function handleToggle(file: LibraryFile) {
    if (!sessionId) return;

    if (attachedIds.has(file.id)) {
      detachMutation.mutate({ sessionId, fileId: file.id });
    } else if (!isMaxReached) {
      attachMutation.mutate({ sessionId, fileId: file.id });
    }
  }

  function renderFile({ item }: { item: LibraryFile }) {
    const Icon = getFileIcon(item.mimeType);
    const isAttached = attachedIds.has(item.id);
    const isDisabled = !isAttached && isMaxReached;

    return (
      <TouchableOpacity
        onPress={() => handleToggle(item)}
        disabled={isDisabled}
        className={`flex-row items-center gap-3 px-4 py-3 border-b border-border ${isDisabled ? 'opacity-40' : ''}`}
        activeOpacity={0.7}
      >
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: isAttached ? bgColors.primary[15] : bgColors.primary[10] }}
        >
          <Icon color={colors.primary} size={20} />
        </View>

        <View className="flex-1">
          <Text numberOfLines={1} className="font-medium">
            {item.fileName}
          </Text>
          <Text variant="tiny" className="text-muted-foreground">
            {formatFileSize(item.sizeBytes)}
            {item.subject ? ` · ${item.subject}` : ''}
          </Text>
        </View>

        {isAttached && (
          <View
            className="h-6 w-6 items-center justify-center rounded-full"
            style={{ backgroundColor: colors.primary }}
          >
            <Check color="#FFFFFF" size={14} />
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between border-b border-border px-4 py-3 pt-4">
          <Text variant="large">Mon Classeur</Text>
          <View className="flex-row items-center gap-3">
            <Text variant="tiny" className="text-muted-foreground">
              {sessionFilesList.length}/10
            </Text>
            <TouchableOpacity
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-muted"
              accessibilityLabel="Fermer"
            >
              <X color={colors.foreground} size={18} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Content */}
        {isLoadingLibrary ? (
          <View className="flex-1 items-center justify-center">
            <Text variant="muted">Chargement...</Text>
          </View>
        ) : libraryFiles.length === 0 ? (
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
              Envoie un fichier dans le chat pour le retrouver ici.
            </Text>
          </View>
        ) : (
          <FlashList
            data={libraryFiles}
            keyExtractor={(item) => item.id}
            renderItem={renderFile}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </Modal>
  );
}
