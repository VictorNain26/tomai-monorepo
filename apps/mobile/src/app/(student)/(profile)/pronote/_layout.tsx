/**
 * Student Pronote Stack - TomAI 2026
 *
 * Screens: Grades, Homework, Timetable
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function PronoteLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="grades" />
      <Stack.Screen name="homework" />
      <Stack.Screen name="timetable" />
    </Stack>
  );
}
