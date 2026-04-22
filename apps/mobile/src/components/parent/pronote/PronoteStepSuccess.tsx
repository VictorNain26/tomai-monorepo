/**
 * PronoteStepSuccess
 *
 * Fourth onboarding step : Pronote session is live, parent picks which
 * detected children to import into TomAI. Delegates the actual selection UI
 * to the reusable `PronoteChildImport` component.
 */

import { PronoteChildImport } from '@/components/parent/PronoteChildImport';
import type { PronoteResource } from '@/services/pronote/pronote-types';

interface PronoteStepSuccessProps {
  resources: PronoteResource[];
  existingChildNames: string[];
  onImport: (selected: PronoteResource[]) => void;
  isSubmitting: boolean;
}

export function PronoteStepSuccess({
  resources,
  existingChildNames,
  onImport,
  isSubmitting,
}: PronoteStepSuccessProps) {
  return (
    <PronoteChildImport
      resources={resources}
      existingChildNames={existingChildNames}
      onImport={onImport}
      isSubmitting={isSubmitting}
    />
  );
}
