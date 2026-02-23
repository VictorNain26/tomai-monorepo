/**
 * ChatInput Component - TomAI 2026
 *
 * Input pour envoyer des messages avec support attachments et voice input.
 * Intègre la dictée vocale avec transcription automatique.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Mic, Square, Send, ImageIcon, Plus, Camera, FileText, Loader2, FolderOpen } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useToast } from '@/components/ui/toast';
import { useVoiceInput, useIconColors } from '@/hooks';
import type { ChatFileAttachment } from '@/hooks';
import { bgColors, colors, opacity, shadows } from '@/lib/styles';

interface ChatInputProps {
  onSendMessage: (content: string) => Promise<void>;
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

export function ChatInput({
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
  const inputRef = useRef<TextInput>(null);
  const iconColors = useIconColors();
  const toast = useToast();

  // Voice input hook
  const voice = useVoiceInput();

  // Attachment menu state
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);

  // Recording pulse animation
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (voice.isRecording) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 500 }),
          withTiming(1, { duration: 500 })
        ),
        -1,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [voice.isRecording, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const canSend =
    !isLoading && !voice.isRecording && !voice.isProcessing &&
    (message.trim().length > 0 || pendingAttachments.length > 0);

  // Handle voice recording toggle
  const handleVoiceToggle = useCallback(async () => {
    if (voice.isRecording) {
      // Stop and get transcription
      const transcription = await voice.stopRecording();
      if (transcription) {
        // Append transcription to message
        setMessage((prev) =>
          prev ? `${prev} ${transcription}` : transcription
        );
      }
    } else if (!voice.isProcessing) {
      // Start recording
      const started = await voice.startRecording();
      if (!started && voice.error) {
        toast.error('Erreur microphone', voice.error);
        voice.clearError();
      }
    }
  }, [voice, toast]);

  // Cancel recording on long press
  const handleVoiceCancel = useCallback(async () => {
    if (voice.isRecording) {
      await voice.cancelRecording();
    }
  }, [voice]);

  async function handleSend() {
    if (!canSend) return;

    const content = message.trim();
    setMessage('');
    await onSendMessage(content);
  }

  async function handlePickDocument() {
    setShowAttachmentMenu(false);
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
    setShowAttachmentMenu(false);
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

  async function handlePickCamera() {
    setShowAttachmentMenu(false);
    if (!onFileSelected) return;

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
                  className="relative rounded-xl bg-muted p-2"
                >
                  {attachment.preview ? (
                    <Image
                      source={{ uri: attachment.preview }}
                      className="h-16 w-16 rounded-lg"
                      resizeMode="cover"
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
                    className="mt-1 max-w-[64px] text-muted-foreground"
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

        {/* Attachment Menu Overlay */}
        {showAttachmentMenu && (
          <TouchableWithoutFeedback onPress={() => setShowAttachmentMenu(false)}>
            <View className="absolute inset-0" style={{ zIndex: 9 }} />
          </TouchableWithoutFeedback>
        )}

        {/* Input Row */}
        <View className="flex-row items-center gap-2">
          {/* Attachment Button "+" */}
          {onFileSelected && (
            <View className="relative">
              <TouchableOpacity
                onPress={() => setShowAttachmentMenu((prev) => !prev)}
                disabled={isLoading || isUploading}
                className="h-10 w-10 items-center justify-center rounded-full"
                style={[
                  { backgroundColor: showAttachmentMenu ? bgColors.primary[10] : bgColors.muted[50] },
                  (isLoading || isUploading) ? { opacity: opacity.disabled } : undefined,
                ]}
                accessibilityLabel="Ajouter un fichier"
              >
                {isUploading ? (
                  <Loader2 color={iconColors.muted} size={18} />
                ) : (
                  <Plus
                    color={showAttachmentMenu ? colors.primary.DEFAULT : iconColors.muted}
                    size={20}
                  />
                )}
              </TouchableOpacity>

              {/* Attachment Popup Menu */}
              {showAttachmentMenu && (
                <View
                  className="absolute bottom-full left-0 mb-2 rounded-xl border border-border bg-card py-1"
                  style={[{ zIndex: 10, minWidth: 180 }, shadows.md]}
                >
                  <TouchableOpacity
                    onPress={handlePickCamera}
                    className="flex-row items-center gap-3 px-4 py-3"
                    accessibilityLabel="Prendre une photo"
                  >
                    <Camera color={colors.primary.DEFAULT} size={18} />
                    <Text className="text-sm text-foreground">Appareil photo</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handlePickImage}
                    className="flex-row items-center gap-3 px-4 py-3"
                    accessibilityLabel="Choisir depuis la galerie"
                  >
                    <ImageIcon color={colors.primary.DEFAULT} size={18} />
                    <Text className="text-sm text-foreground">Galerie</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={handlePickDocument}
                    className="flex-row items-center gap-3 px-4 py-3"
                    accessibilityLabel="Choisir un document"
                  >
                    <FileText color={colors.primary.DEFAULT} size={18} />
                    <Text className="text-sm text-foreground">Document</Text>
                  </TouchableOpacity>
                  {onOpenClasseur && (
                    <TouchableOpacity
                      onPress={() => {
                        setShowAttachmentMenu(false);
                        onOpenClasseur();
                      }}
                      className="flex-row items-center gap-3 px-4 py-3"
                      accessibilityLabel="Mon Classeur"
                    >
                      <FolderOpen color={colors.primary.DEFAULT} size={18} />
                      <Text className="text-sm text-foreground">Mon Classeur</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Text Input / Recording State */}
          <View className="flex-1 flex-row items-center rounded-2xl border border-input bg-background px-3">
            {voice.isRecording ? (
              <View className="flex-1 flex-row items-center gap-2 py-3">
                <Animated.View
                  style={[
                    {
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: colors.destructive.DEFAULT,
                    },
                    pulseStyle,
                  ]}
                />
                <Text className="text-base font-semibold text-destructive">
                  {voice.duration}s
                </Text>
                <Text className="flex-1 text-sm text-muted-foreground">
                  Appui long pour annuler
                </Text>
              </View>
            ) : voice.isProcessing ? (
              <View className="flex-1 flex-row items-center gap-2 py-3">
                <Loader2 color={iconColors.muted} size={16} />
                <Text className="text-base text-muted-foreground">
                  Transcription...
                </Text>
              </View>
            ) : (
              <TextInput
                ref={inputRef}
                value={message}
                onChangeText={setMessage}
                placeholder={placeholder}
                placeholderTextColor={colors.muted.foreground}
                multiline
                maxLength={2000}
                editable={!isLoading}
                onSubmitEditing={handleSend}
                blurOnSubmit={false}
                className="max-h-24 flex-1 py-3 text-base text-foreground"
              />
            )}
          </View>

          {/* Voice Button */}
          <TouchableOpacity
            onPress={handleVoiceToggle}
            onLongPress={handleVoiceCancel}
            disabled={isLoading || voice.isProcessing}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: voice.isRecording
                ? colors.destructive.DEFAULT
                : bgColors.muted[50],
              opacity: isLoading || voice.isProcessing ? opacity.disabled : 1,
            }}
            accessibilityLabel={
              voice.isRecording
                ? "Arrêter l'enregistrement"
                : 'Enregistrer un message vocal'
            }
            accessibilityHint="Appui long pour annuler"
          >
            {voice.isRecording ? (
              <Square color={colors.primary.foreground} size={16} fill={colors.primary.foreground} />
            ) : voice.isProcessing ? (
              <Mic color={iconColors.muted} size={18} />
            ) : (
              <Mic color={iconColors.foreground} size={18} />
            )}
          </TouchableOpacity>

          {/* Send Button */}
          <TouchableOpacity
            onPress={handleSend}
            disabled={!canSend}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{
              backgroundColor: canSend
                ? colors.primary.DEFAULT
                : bgColors.muted[50],
            }}
            accessibilityLabel="Envoyer le message"
          >
            <Send
              color={canSend ? colors.primary.foreground : iconColors.muted}
              size={18}
              style={!canSend ? { opacity: opacity.disabled } : undefined}
            />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
