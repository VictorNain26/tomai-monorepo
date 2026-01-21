/**
 * ChatInput Component
 *
 * Input pour envoyer des messages avec support attachments.
 */

import { useState, useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { ChatFileAttachment } from '@/hooks';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
  onFileSelected?: (
    uri: string,
    fileName: string,
    mimeType: string
  ) => Promise<void>;
  pendingAttachments: ChatFileAttachment[];
  onRemoveAttachment?: (fileId: string) => void;
  isLoading?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  onFileSelected,
  pendingAttachments,
  onRemoveAttachment,
  isLoading = false,
  placeholder = 'Pose ta question...',
}: ChatInputProps) {
  const [message, setMessage] = useState('');
  const inputRef = useRef<TextInput>(null);

  const canSend =
    !isLoading && (message.trim().length > 0 || pendingAttachments.length > 0);

  async function handleSend() {
    if (!canSend) return;

    const content = message.trim();
    setMessage('');
    await onSendMessage(content);
  }

  async function handlePickDocument() {
    if (!onFileSelected) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      await onFileSelected(
        file.uri,
        file.name,
        file.mimeType ?? 'application/octet-stream'
      );
    } catch {
      // User cancelled or error
    }
  }

  async function handlePickImage() {
    if (!onFileSelected) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      const fileName =
        asset.fileName ?? `image_${Date.now()}.${asset.type ?? 'jpg'}`;
      await onFileSelected(asset.uri, fileName, asset.mimeType ?? 'image/jpeg');
    } catch {
      // User cancelled or error
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="border-t border-border bg-background px-4 pb-4 pt-2">
        {/* Pending Attachments */}
        {pendingAttachments.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-2"
          >
            <View className="flex-row gap-2">
              {pendingAttachments.map((attachment) => (
                <View
                  key={attachment.fileId}
                  className="relative rounded-lg bg-muted p-2"
                >
                  {attachment.preview ? (
                    <Image
                      source={{ uri: attachment.preview }}
                      className="h-16 w-16 rounded"
                      resizeMode="cover"
                    />
                  ) : (
                    <View className="h-16 w-16 items-center justify-center rounded bg-muted-foreground/20">
                      <Text className="text-2xl">📄</Text>
                    </View>
                  )}
                  <Text
                    className="mt-1 max-w-[64px] text-xs text-muted-foreground"
                    numberOfLines={1}
                  >
                    {attachment.fileName}
                  </Text>
                  {onRemoveAttachment && (
                    <TouchableOpacity
                      onPress={() => onRemoveAttachment(attachment.fileId)}
                      className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full bg-destructive"
                    >
                      <Text className="text-xs text-white">✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
            </View>
          </ScrollView>
        )}

        {/* Input Row */}
        <View className="flex-row items-end gap-2">
          {/* Attachment Buttons */}
          {onFileSelected && (
            <View className="flex-row gap-1 pb-1">
              <TouchableOpacity
                onPress={handlePickImage}
                disabled={isLoading}
                className={cn(
                  'h-10 w-10 items-center justify-center rounded-full bg-muted',
                  isLoading && 'opacity-50'
                )}
              >
                <Text className="text-lg">🖼️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handlePickDocument}
                disabled={isLoading}
                className={cn(
                  'h-10 w-10 items-center justify-center rounded-full bg-muted',
                  isLoading && 'opacity-50'
                )}
              >
                <Text className="text-lg">📎</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Text Input */}
          <View className="flex-1 flex-row items-end rounded-2xl border border-input bg-background px-3">
            <TextInput
              ref={inputRef}
              value={message}
              onChangeText={setMessage}
              placeholder={placeholder}
              placeholderTextColor="hsl(215.4 16.3% 46.9%)"
              multiline
              maxLength={2000}
              editable={!isLoading}
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              className="max-h-24 flex-1 py-3 text-base text-foreground"
            />
          </View>

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            className={cn(
              'h-10 w-10 items-center justify-center rounded-full',
              canSend ? 'bg-primary' : 'bg-muted'
            )}
          >
            <Text className={cn('text-lg', canSend ? '' : 'opacity-50')}>
              {isLoading ? '⏳' : '➤'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
