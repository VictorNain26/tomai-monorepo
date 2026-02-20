/**
 * QuickAskCard Component
 *
 * Simple, non-intrusive prompt to ask Tom a question.
 * Secondary to Pronote-driven engagement - always available but not the focus.
 */

import { View, TextInput, TouchableOpacity } from 'react-native';
import { useState, useRef } from 'react';
import { MessageCircle, Send, Mic } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { useIconColors } from '@/hooks';
import { bgColors, shadows, colors } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

interface QuickAskCardProps {
  /** User's first name for personalization */
  userName?: string;
  /** Whether voice input is available */
  voiceEnabled?: boolean;
  onVoicePress?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function QuickAskCard({
  userName,
  voiceEnabled = false,
  onVoicePress,
}: QuickAskCardProps) {
  const router = useRouter();
  const iconColors = useIconColors();
  const inputRef = useRef<TextInput>(null);
  const [question, setQuestion] = useState('');

  function handleSubmit() {
    if (!question.trim()) return;

    router.push({
      pathname: '/(student)/(home)/chat',
      params: {
        prompt: question.trim(),
      },
    });

    setQuestion('');
  }

  function handlePress() {
    // Focus the input when card is pressed
    inputRef.current?.focus();
  }

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={handlePress}
      style={shadows.sm}
      className="rounded-xl bg-card"
    >
      {/* Header */}
      <View className="flex-row items-center gap-3 p-4 pb-2">
        <View
          className="h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: bgColors.primary[10] }}
        >
          <MessageCircle color={iconColors.primary} size={20} />
        </View>
        <View className="flex-1">
          <Text variant="large">Demander à Tom</Text>
          <Text variant="muted">
            {userName ? `${userName}, pose` : 'Pose'} ta question
          </Text>
        </View>
      </View>

      {/* Input area */}
      <View className="flex-row items-center gap-2 p-4 pt-2">
        <View className="flex-1 flex-row items-center rounded-lg border border-border bg-background px-3">
          <TextInput
            ref={inputRef}
            value={question}
            onChangeText={setQuestion}
            placeholder="Explique-moi les fractions..."
            placeholderTextColor={colors.muted.foreground}
            className="flex-1 py-3 text-base text-foreground"
            returnKeyType="send"
            onSubmitEditing={handleSubmit}
            blurOnSubmit={false}
          />

          {/* Voice button */}
          {voiceEnabled && (
            <TouchableOpacity
              onPress={onVoicePress}
              className="p-1"
              accessibilityRole="button"
              accessibilityLabel="Dictée vocale"
            >
              <Mic color={iconColors.muted} size={20} />
            </TouchableOpacity>
          )}
        </View>

        {/* Send button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!question.trim()}
          className="h-12 w-12 items-center justify-center rounded-lg bg-primary"
          style={!question.trim() ? { opacity: 0.5 } : undefined}
          accessibilityRole="button"
          accessibilityLabel="Envoyer la question"
        >
          <Send color={colors.primary.foreground} size={20} />
        </TouchableOpacity>
      </View>

      {/* Quick suggestions */}
      <View className="flex-row flex-wrap gap-2 px-4 pb-4">
        <QuickSuggestion
          text="Aide-moi avec mes devoirs"
          onPress={() => router.push({ pathname: '/(student)/(home)/chat', params: { prompt: 'Aide-moi avec mes devoirs' } })}
        />
        <QuickSuggestion
          text="Explique ce cours"
          onPress={() => router.push({ pathname: '/(student)/(home)/chat', params: { prompt: 'Peux-tu m\'expliquer ce cours ?' } })}
        />
      </View>
    </TouchableOpacity>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface QuickSuggestionProps {
  text: string;
  onPress: () => void;
}

function QuickSuggestion({ text, onPress }: QuickSuggestionProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-md border border-border px-3 py-1.5"
      accessibilityRole="button"
    >
      <Text variant="small" className="text-muted-foreground">
        {text}
      </Text>
    </TouchableOpacity>
  );
}
