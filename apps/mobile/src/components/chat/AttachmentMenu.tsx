/**
 * AttachmentMenu Component
 *
 * Popup menu for adding files (camera, gallery, document, classeur).
 */

import { useCallback } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Camera, ImageIcon, FileText, FolderOpen, Loader2 } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks';
import { bgColors, shadows } from '@/lib/styles';

interface AttachmentMenuProps {
  visible: boolean;
  onToggle: () => void;
  onClose: () => void;
  onFileSelected: (uri: string, fileName: string, mimeType: string) => Promise<void>;
  onOpenClasseur?: () => void;
  isDisabled: boolean;
  isUploading: boolean;
}

export function AttachmentMenu({
  visible,
  onToggle,
  onClose,
  onFileSelected,
  onOpenClasseur,
  isDisabled,
  isUploading,
}: AttachmentMenuProps) {
  const colors = useThemeColors();

  const handlePickCamera = useCallback(async () => {
    onClose();
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const fileName = asset.fileName ?? `photo_${Date.now()}.jpg`;
      await onFileSelected(asset.uri, fileName, asset.mimeType ?? 'image/jpeg');
    } catch {
      // User cancelled or error
    }
  }, [onClose, onFileSelected]);

  const handlePickImage = useCallback(async () => {
    onClose();
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const fileName = asset.fileName ?? `image_${Date.now()}.${asset.type ?? 'jpg'}`;
      await onFileSelected(asset.uri, fileName, asset.mimeType ?? 'image/jpeg');
    } catch {
      // User cancelled or error
    }
  }, [onClose, onFileSelected]);

  const handlePickDocument = useCallback(async () => {
    onClose();
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const file = result.assets[0];
      await onFileSelected(file.uri, file.name, file.mimeType ?? 'application/octet-stream');
    } catch {
      // User cancelled or error
    }
  }, [onClose, onFileSelected]);

  const handleOpenClasseur = useCallback(() => {
    onClose();
    onOpenClasseur?.();
  }, [onClose, onOpenClasseur]);

  return (
    <>
      {/* Overlay to dismiss */}
      {visible && (
        <Pressable
          onPress={onClose}
          className="absolute inset-0"
          style={{ zIndex: 9 }}
        />
      )}

      <View className="relative">
        <TouchableOpacity
          onPress={onToggle}
          disabled={isDisabled}
          className="h-11 w-11 items-center justify-center rounded-full"
          style={[
            { backgroundColor: visible ? bgColors.primary[10] : bgColors.muted[50] },
            isDisabled ? { opacity: 0.5 } : undefined,
          ]}
          accessibilityLabel="Ajouter un fichier"
          accessibilityHint="Ouvre le menu pour ajouter une photo, un document ou un fichier"
        >
          {isUploading ? (
            <Loader2 color={colors.muted} size={18} />
          ) : (
            <Plus
              color={visible ? colors.primary : colors.muted}
              size={20}
            />
          )}
        </TouchableOpacity>

        {/* Popup Menu */}
        {visible && (
          <View
            className="absolute bottom-full left-0 mb-2 rounded-xl bg-white dark:bg-stone-800 py-1"
            style={[{ zIndex: 10, minWidth: 180 }, shadows.md]}
          >
            <TouchableOpacity
              onPress={handlePickCamera}
              className="flex-row items-center gap-3 px-4 py-3"
              accessibilityLabel="Prendre une photo"
            >
              <Camera color={colors.primary} size={18} />
              <Text className="text-sm text-stone-800 dark:text-stone-100">Appareil photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickImage}
              className="flex-row items-center gap-3 px-4 py-3"
              accessibilityLabel="Choisir depuis la galerie"
            >
              <ImageIcon color={colors.primary} size={18} />
              <Text className="text-sm text-stone-800 dark:text-stone-100">Galerie</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handlePickDocument}
              className="flex-row items-center gap-3 px-4 py-3"
              accessibilityLabel="Choisir un document"
            >
              <FileText color={colors.primary} size={18} />
              <Text className="text-sm text-stone-800 dark:text-stone-100">Document</Text>
            </TouchableOpacity>
            {onOpenClasseur && (
              <TouchableOpacity
                onPress={handleOpenClasseur}
                className="flex-row items-center gap-3 px-4 py-3"
                accessibilityLabel="Mon Classeur"
              >
                <FolderOpen color={colors.primary} size={18} />
                <Text className="text-sm text-stone-800 dark:text-stone-100">Mon Classeur</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </>
  );
}
