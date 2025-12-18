import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Mic, Paperclip } from 'lucide-react-native';

import { Text } from '@/components/ui/text';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

export default function ChatScreen() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSend() {
    if (!inputText.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputText.trim(),
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    // TODO: Implement actual API call to chat endpoint
    // Simulate response for now
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content:
          "Je suis Tom, ton tuteur IA ! Cette fonctionnalité sera bientôt disponible. En attendant, n'hésite pas à explorer l'application.",
        role: 'assistant',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1000);
  }

  function renderMessage({ item }: { item: Message }) {
    const isUser = item.role === 'user';
    return (
      <View
        className={`mb-3 max-w-[85%] ${isUser ? 'self-end' : 'self-start'}`}
      >
        <View
          className={`rounded-2xl px-4 py-3 ${
            isUser ? 'bg-primary' : 'bg-muted'
          }`}
        >
          <Text className={isUser ? 'text-primary-foreground' : ''}>
            {item.content}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View className="border-b border-border px-4 py-3">
          <Text variant="h3">Chat avec Tom</Text>
          <Text variant="muted" className="text-sm">
            Ton tuteur IA personnel
          </Text>
        </View>

        {/* Messages */}
        {messages.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              <Text className="text-4xl">🤖</Text>
            </View>
            <Text variant="h3" className="text-center">
              Salut ! Je suis Tom
            </Text>
            <Text variant="muted" className="mt-2 text-center">
              Pose-moi une question sur tes cours, je suis là pour t'aider à
              comprendre et réviser !
            </Text>
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Loading indicator */}
        {isLoading && (
          <View className="px-4 py-2">
            <View className="max-w-[85%] self-start rounded-2xl bg-muted px-4 py-3">
              <Text variant="muted">Tom réfléchit...</Text>
            </View>
          </View>
        )}

        {/* Input */}
        <View className="border-t border-border bg-background px-4 py-3">
          <View className="flex-row items-end gap-2">
            <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full">
              <Paperclip color="hsl(215.4, 16.3%, 46.9%)" size={20} />
            </TouchableOpacity>

            <View className="flex-1 flex-row items-end rounded-2xl border border-border bg-muted px-4 py-2">
              <TextInput
                value={inputText}
                onChangeText={setInputText}
                placeholder="Pose ta question..."
                placeholderTextColor="hsl(215.4, 16.3%, 46.9%)"
                multiline
                maxLength={2000}
                className="max-h-24 flex-1 text-base text-foreground"
                style={{ paddingVertical: 4 }}
              />
            </View>

            <TouchableOpacity className="h-10 w-10 items-center justify-center rounded-full">
              <Mic color="hsl(215.4, 16.3%, 46.9%)" size={20} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || isLoading}
              className={`h-10 w-10 items-center justify-center rounded-full ${
                inputText.trim() && !isLoading ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Send
                color={
                  inputText.trim() && !isLoading
                    ? 'hsl(210, 40%, 98%)'
                    : 'hsl(215.4, 16.3%, 46.9%)'
                }
                size={18}
              />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
