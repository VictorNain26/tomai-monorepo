/**
 * PronoteStepPin
 *
 * Third onboarding step : wraps the reusable `PronotePinEntry` component
 * (Pronote 4-digit PIN collected after QR scan) in a keyboard-friendly
 * ScrollView so the numeric keypad doesn't hide the submit button.
 */

import { ScrollView } from 'react-native';

import { PronotePinEntry } from '@/components/parent';

interface PronoteStepPinProps {
  establishment: string;
  pin: string;
  onPinChange: (pin: string) => void;
  onSubmit: () => void;
  onReset: () => void;
  error: string | null;
  isPending: boolean;
}

export function PronoteStepPin({
  establishment,
  pin,
  onPinChange,
  onSubmit,
  onReset,
  error,
  isPending,
}: PronoteStepPinProps) {
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled"
    >
      <PronotePinEntry
        establishment={establishment}
        pin={pin}
        onPinChange={onPinChange}
        onSubmit={onSubmit}
        onReset={onReset}
        error={error}
        isPending={isPending}
      />
    </ScrollView>
  );
}
