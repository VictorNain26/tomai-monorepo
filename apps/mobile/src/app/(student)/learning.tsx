import { View, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  BookOpen,
  Brain,
  Calculator,
  Globe,
  Beaker,
  History,
  Languages,
  Music,
  Palette,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';

interface Subject {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  cardCount: number;
}

const subjects: Subject[] = [
  {
    id: 'math',
    name: 'Mathématiques',
    icon: <Calculator color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-blue-100',
    cardCount: 0,
  },
  {
    id: 'french',
    name: 'Français',
    icon: <BookOpen color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-red-100',
    cardCount: 0,
  },
  {
    id: 'science',
    name: 'Sciences',
    icon: <Beaker color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-green-100',
    cardCount: 0,
  },
  {
    id: 'history',
    name: 'Histoire-Géo',
    icon: <History color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-amber-100',
    cardCount: 0,
  },
  {
    id: 'english',
    name: 'Anglais',
    icon: <Globe color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-purple-100',
    cardCount: 0,
  },
  {
    id: 'languages',
    name: 'Langues',
    icon: <Languages color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-pink-100',
    cardCount: 0,
  },
  {
    id: 'philosophy',
    name: 'Philosophie',
    icon: <Brain color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-indigo-100',
    cardCount: 0,
  },
  {
    id: 'arts',
    name: 'Arts',
    icon: <Palette color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-orange-100',
    cardCount: 0,
  },
  {
    id: 'music',
    name: 'Musique',
    icon: <Music color="hsl(222.2, 47.4%, 11.2%)" size={24} />,
    color: 'bg-teal-100',
    cardCount: 0,
  },
];

export default function LearningScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1 px-4 py-6">
        {/* Header */}
        <View className="mb-6">
          <Text variant="h2" className="text-primary">
            Révisions
          </Text>
          <Text variant="muted" className="mt-1">
            Sélectionne une matière pour commencer
          </Text>
        </View>

        {/* Due for review section */}
        <View className="mb-6 rounded-xl border border-border bg-card p-4">
          <View className="flex-row items-center justify-between">
            <View>
              <Text variant="h3">À réviser aujourd'hui</Text>
              <Text variant="muted" className="mt-1">
                0 cartes en attente
              </Text>
            </View>
            <TouchableOpacity
              className="rounded-lg bg-primary px-4 py-2"
              disabled={true}
            >
              <Text className="font-semibold text-primary-foreground">
                Commencer
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Subjects Grid */}
        <Text variant="h3" className="mb-4">
          Par matière
        </Text>
        <View className="flex-row flex-wrap gap-3">
          {subjects.map(subject => (
            <TouchableOpacity
              key={subject.id}
              className={`w-[48%] rounded-xl border border-border p-4 ${subject.color}`}
              activeOpacity={0.7}
            >
              <View className="mb-2">{subject.icon}</View>
              <Text className="font-semibold">{subject.name}</Text>
              <Text variant="muted" className="text-sm">
                {subject.cardCount} cartes
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Empty state info */}
        <View className="mt-6 rounded-xl border border-border bg-muted/50 p-4">
          <Text variant="muted" className="text-center text-sm">
            💡 Les flashcards sont générées automatiquement à partir de tes
            conversations avec Tom. Plus tu poses de questions, plus tu auras de
            cartes à réviser !
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
