/**
 * Child Detail Layout
 *
 * Stack layout for child detail screens (grades, homework, timetable, edit).
 */

import { Stack } from 'expo-router';

export default function ChildDetailLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    />
  );
}
