/**
 * AttachmentPreview Component
 *
 * Horizontal scrollable list of pending file attachments.
 */

import { View, ScrollView, TouchableOpacity, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import type { ChatFileAttachment } from '@/hooks';
import { bgColors } from '@/lib/styles';

interface AttachmentPreviewProps {
  attachments: ChatFileAttachment[];
  onRemove?: (fileId: string) => void;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="mb-2"
    >
      <View className="flex-row gap-2">
        {attachments.map((attachment) => (
          <View
            key={attachment.fileId}
            className="relative rounded-xl bg-stone-100 dark:bg-stone-800 p-2"
          >
            {attachment.preview ? (
              <Image
                source={{ uri: attachment.preview }}
                className="h-16 w-16 rounded-lg"
                resizeMode="cover"
                accessibilityLabel={`Apercu: ${attachment.fileName}`}
              />
            ) : (
              <View
                className="h-16 w-16 items-center justify-center rounded-lg"
                style={{ backgroundColor: bgColors.primary[10] }}
              >
                <Text className="text-2xl">📄</Text>
              </View>
            )}
            <Text
              variant="tiny"
              className="mt-1 max-w-[64px] text-stone-500 dark:text-stone-400"
              numberOfLines={1}
            >
              {attachment.fileName}
            </Text>
            {onRemove && (
              <TouchableOpacity
                onPress={() => onRemove(attachment.fileId)}
                className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-red-600 dark:bg-red-400"
                accessibilityLabel={`Supprimer ${attachment.fileName}`}
              >
                <Text className="text-xs text-white">✕</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
