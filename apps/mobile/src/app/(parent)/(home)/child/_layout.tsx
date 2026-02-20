/**
 * Parent Child Routes Stack - TomAI 2026
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ChildLayout() {
  return <Stack screenOptions={useStackScreenOptions()} />;
}
