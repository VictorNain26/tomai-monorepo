/**
 * Student Dashboard
 *
 * Main screen with subjects grid, token usage, and recent sessions.
 */

import { View, ScrollView, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import { MessageCircle, BookOpen, Clock } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { SubjectsGrid, TokenUsageCard, StudentPronoteCard } from '@/components/dashboard';
import { useStudentDashboard, useStudentPronote } from '@/hooks';

export default function StudentDashboard() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const {
    subjects,
    isLoadingSubjects,
    usage,
    isLoadingUsage,
    latestSession,
    userName,
  } = useStudentDashboard();

  const pronote = useStudentPronote();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Queries will refetch automatically due to staleTime
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  function handleContinueSession() {
    if (latestSession) {
      router.push({
        pathname: '/(student)/chat',
        params: {
          subject: latestSession.subject,
          sessionId: latestSession.id,
        },
      });
    }
  }

  function handlePronoteNavigate(section: 'homework' | 'grades' | 'timetable') {
    if (!pronote.isConnected) {
      Alert.alert(
        'Pronote non connecté',
        'Demande à ton parent de connecter Pronote.'
      );
      return;
    }
    router.push(`/(student)/pronote/${section}`);
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1 px-4 py-6"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View className="mb-6">
          <Text variant="h2" className="text-primary">
            Bonjour, {userName} 👋
          </Text>
          <Text variant="muted" className="mt-1">
            Prêt pour une session de révision ?
          </Text>
        </View>

        {/* Token Usage */}
        <View className="mb-6">
          <TokenUsageCard usage={usage} isLoading={isLoadingUsage} />
        </View>

        {/* Quick Actions */}
        <View className="mb-6 gap-3">
          <Button
            onPress={() => router.push('/(student)/chat')}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <MessageCircle color="hsl(210, 40%, 98%)" size={24} />
            <View>
              <Text className="font-semibold text-primary-foreground">
                Nouvelle conversation
              </Text>
              <Text className="text-sm text-primary-foreground/80">
                Pose tes questions à Tom
              </Text>
            </View>
          </Button>

          <Button
            variant="outline"
            onPress={() => router.push('/(student)/learning')}
            className="flex-row items-center justify-start gap-3 p-4"
          >
            <BookOpen color="hsl(222.2, 47.4%, 11.2%)" size={24} />
            <View>
              <Text className="font-semibold">Réviser mes flashcards</Text>
              <Text variant="muted" className="text-sm">
                Continue ton apprentissage
              </Text>
            </View>
          </Button>
        </View>

        {/* Pronote Section */}
        <View className="mb-6">
          <StudentPronoteCard
            status={pronote.isConnected ? {
              isConnected: true,
              establishmentName: pronote.establishmentName,
              pronoteChildName: pronote.studentName,
              className: pronote.className,
            } : undefined}
            upcomingHomework={pronote.upcomingHomework}
            averageGrade={pronote.averageGrade}
            isLoading={pronote.isLoading}
            onNavigate={handlePronoteNavigate}
          />
        </View>

        {/* Subjects Grid */}
        <Text variant="h3" className="mb-4">
          Matières
        </Text>
        <View className="mb-6">
          <SubjectsGrid subjects={subjects} isLoading={isLoadingSubjects} />
        </View>

        {/* Recent Session */}
        {latestSession && (
          <>
            <Text variant="h3" className="mb-4">
              Dernière conversation
            </Text>
            <TouchableOpacity
              onPress={handleContinueSession}
              className="mb-6 rounded-xl border border-border bg-card p-4"
            >
              <View className="flex-row items-center gap-3">
                <View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Clock color="hsl(222.2, 47.4%, 11.2%)" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-medium capitalize">
                    {latestSession.subject.replace('-', ' ')}
                  </Text>
                  <Text variant="muted" className="text-sm">
                    {latestSession.messagesCount} messages
                  </Text>
                </View>
                <Text className="text-primary">Continuer →</Text>
              </View>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
