/**
 * Parent Child Detail Stack - TomAI 2026
 *
 * Screens: Detail, Grades, Homework, Timetable, Edit
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ChildDetailLayout() {
  return <Stack screenOptions={useStackScreenOptions()} />;
}
