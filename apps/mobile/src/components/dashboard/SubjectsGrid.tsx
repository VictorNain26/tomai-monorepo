/**
 * SubjectsGrid Component
 *
 * Grid of subjects for student dashboard navigation to chat.
 */

import { View, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from '@/components/ui/text';
import type { Subject } from '@/hooks/useStudentDashboard';

interface SubjectsGridProps {
  subjects: Subject[];
  isLoading?: boolean;
}

export function SubjectsGrid({ subjects, isLoading = false }: SubjectsGridProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <View className="flex-row flex-wrap gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <View
            key={i}
            className="h-24 w-[30%] animate-pulse rounded-xl bg-muted"
          />
        ))}
      </View>
    );
  }

  if (subjects.length === 0) {
    return (
      <View className="rounded-xl border border-border bg-card p-6">
        <Text variant="muted" className="text-center">
          Aucune matière disponible pour ton niveau.
        </Text>
      </View>
    );
  }

  function handleSubjectPress(subject: Subject) {
    router.push({
      pathname: '/(student)/chat',
      params: { subject: subject.key },
    });
  }

  return (
    <FlatList
      data={subjects}
      keyExtractor={(item) => item.key}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={{ gap: 12 }}
      contentContainerStyle={{ gap: 12 }}
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => handleSubjectPress(item)}
          className="flex-1 items-center rounded-xl border border-border bg-card p-3"
          style={{ minWidth: '30%', maxWidth: '32%' }}
        >
          <Text className="mb-1 text-2xl">{item.emoji}</Text>
          <Text className="text-center text-xs font-medium" numberOfLines={2}>
            {item.name}
          </Text>
          {!item.ragAvailable && (
            <View className="mt-1 rounded-full bg-muted px-1.5 py-0.5">
              <Text className="text-[10px] text-muted-foreground">Bientôt</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}
