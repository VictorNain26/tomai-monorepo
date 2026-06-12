/**
 * PronoteStepChildPin
 *
 * Fifth onboarding step : sequentially prompts the parent to pick a school
 * level and a PIN / password for each imported child. Wraps the reusable
 * `ChildPinSetup` component and overlays the "creating accounts" loader once
 * the last child's PIN has been submitted.
 */

import { View } from 'react-native';

import { Text } from '@/components/ui/text';
import { ChildPinSetup } from '@/components/parent/ChildPinSetup';
import { PronoteStepConnecting } from './PronoteStepConnecting';
import type { PronoteResource } from '@/services/pronote/pronote-types';
import type { ChildPinData } from '@/hooks/usePronoteOnboarding';

interface PronoteStepChildPinProps {
  resource: PronoteResource;
  index: number;
  total: number;
  isCreatingChildren: boolean;
  error: string | null;
  onComplete: (data: ChildPinData) => void;
}

export function PronoteStepChildPin({
  resource,
  index,
  total,
  isCreatingChildren,
  error,
  onComplete,
}: PronoteStepChildPinProps) {
  return (
    <View className="flex-1">
      {isCreatingChildren ? (
        <PronoteStepConnecting />
      ) : (
        <ChildPinSetup
          resource={resource}
          index={index}
          total={total}
          onComplete={onComplete}
        />
      )}
      {error && (
        <View className="mx-4 mb-4 rounded-xl bg-destructive/10 p-4">
          <Text className="text-center text-destructive">
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}
