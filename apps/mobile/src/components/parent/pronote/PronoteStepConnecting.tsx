/**
 * PronoteStepConnecting
 *
 * Transient loader shown while child accounts are being created server-side
 * after the parent has configured every child's PIN.
 */

import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { TomAvatar } from '@/components/common';

export function PronoteStepConnecting() {
  return (
    <View className="flex-1 items-center justify-center px-6">
      <TomAvatar size="lg" />
      <Text className="mt-4 text-center text-lg font-semibold">
        Creation des comptes...
      </Text>
      <Text variant="muted" className="mt-2 text-center">
        Veuillez patienter
      </Text>
    </View>
  );
}
