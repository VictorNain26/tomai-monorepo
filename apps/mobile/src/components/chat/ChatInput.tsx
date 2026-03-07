/**
 * ChatInput Component - TomAI 2026
 *
 * Input pour envoyer des messages avec support attachments.
 */

import { memo, useState, useCallback } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Send } from 'lucide-react-native';
import { useIconColors, useThemeColors } from '@/hooks';
import type { ChatFileAttachment } from '@/hooks';
import { bgColors } from '@/lib/styles';
import { AttachmentMenu } from './AttachmentMenu';
import { AttachmentPreview } from './AttachmentPreview';

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  onFileSelected?: (
    uri: string,
    fileName: string,
    mimeType: string
  ) => Promise<void>;
  onOpenClasseur?: () => void;
  pendingAttachments: ChatFileAttachment[];
  onRemoveAttachment?: (fileId: string) => void;
  isLoading?: boolean;
  isUploading?: boolean;
  placeholder?: string;
}

export const ChatInput = memo(function ChatInput({
  onSendMessage,
  onFileSelected,
  onOpenClasseur,
  pendingAttachments,
  onRemoveAttachment,
  isLoading = false,
  isUploading = false,
  placeholder = 'Pose ta question...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  const canSend =
    !isLoading &&
    (message.trim().length > 0 || pendingAttachments.length > 0);

  const handleSend = useCallback(() => {
    if (!canSend) return;
    const content = message.trim();
    setMessage('');
    onSendMessage(content);
  }, [canSend, message, onSendMessage]);

  const handleToggleMenu = useCallback(() => {
    setShowAttachmentMenu((prev) => !prev);
  }, []);

  const handleCloseMenu = useCallback(() => {
    setShowAttachmentMenu(false);
  }, []);

  return (
    <View className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 pb-4 pt-2">
      <AttachmentPreview
        attachments={pendingAttachments}
        onRemove={onRemoveAttachment}
      />

      {/* Input Row */}
      <View className="flex-row items-center gap-2">
        {/* Attachment Button */}
        {onFileSelected && (
          <AttachmentMenu
            visible={showAttachmentMenu}
            onToggle={handleToggleMenu}
            onClose={handleCloseMenu}
            onFileSelected={onFileSelected}
            onOpenClasseur={onOpenClasseur}
            isDisabled={isLoading || isUploading}
            isUploading={isUploading}
          />
        )}

        {/* Text Input */}
        <View className="flex-1 flex-row items-center rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3">
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={placeholder}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2000}
            editable={!isLoading}
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
            className="max-h-24 flex-1 py-3 text-base text-slate-800 dark:text-slate-100"
          />
        </View>

        {/* Send Button */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!canSend}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: canSend
              ? colors.primary
              : bgColors.muted[50],
          }}
          accessibilityLabel="Envoyer le message"
        >
          <Send
            color={canSend ? colors.primaryForeground : iconColors.muted}
            size={18}
            style={!canSend ? { opacity: 0.5 } : undefined}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});
