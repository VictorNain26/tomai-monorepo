/**
 * usePronoteReconnect Hook
 *
 * State machine for the Pronote (re)connect flow shown from the parent profile
 * tab (or re-exported from the child detail screen). Unlike the initial
 * onboarding (`usePronoteOnboarding`), this flow assumes the parent already
 * has a TomAI account with a parent PIN configured, so there is no welcome /
 * parent-pin step.
 *
 * Step transitions :
 *   scan -> pin -> import -> pin-setup
 *
 * Critical ordering difference vs. onboarding : child accounts are created
 * with a temporary password BEFORE the pin-setup loop (so we can register the
 * Pronote resource mapping immediately), then each child's chosen PIN is
 * stored via `setCredential` as the user steps through `pin-setup`. This
 * preserves the Pawnote call order of the pre-refactor screen.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';
import * as Crypto from 'expo-crypto';

import { usePronote, useParentDashboard } from '@/hooks';
import { useUser } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { useChildAccessStore } from '@/stores/child-access-store';
import {
  splitPronoteName,
  toPronoteDedupeKey,
  parseQrCode,
  extractEstablishment,
  pronoteUsername,
} from '@/lib/pronote-helpers';
import type {
  PronoteResource,
  QrCodeData,
} from '@/services/pronote/pronote-types';
import type { ChildPinData } from '@/hooks/usePronoteOnboarding';

// ============================================================================
// TYPES
// ============================================================================

type ReconnectStep = 'scan' | 'pin' | 'import' | 'pin-setup';

interface UsePronoteReconnectResult {
  // ---- State ----
  step: ReconnectStep;
  establishment: string;
  pin: string;
  error: string | null;
  isConnecting: boolean;
  resources: PronoteResource[];
  existingChildNames: string[];
  selectedResources: PronoteResource[];
  currentPinSetupIndex: number;
  isImporting: boolean;

  // ---- Setters (direct, for controlled inputs) ----
  setPin: (value: string) => void;

  // ---- Actions (state transitions) ----
  handleBarCodeScanned: (result: { data: string }) => void;
  handlePinSubmit: () => Promise<void>;
  handlePinReset: () => void;
  handleImport: (selected: PronoteResource[]) => Promise<void>;
  handleChildPinComplete: (data: ChildPinData) => Promise<void>;
}

// ============================================================================
// HELPERS
// ============================================================================

// Bytes of temporary password entropy. 16 bytes → 128 bits, well above the
// server's password policy floor. Encoded as hex (32 chars) for safe transit.
const TEMP_PASSWORD_BYTES = 16;

async function generateTempPassword(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(TEMP_PASSWORD_BYTES);
  return `tmp-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

// ============================================================================
// HOOK
// ============================================================================

export function usePronoteReconnect(): UsePronoteReconnectResult {
  const router = useRouter();
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const { createChild, children } = useParentDashboard();
  const setCredential = useChildAccessStore((s) => s.setCredential);
  const toast = useToast();

  // Flow state
  const [step, setStep] = useState<ReconnectStep>('scan');
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [establishment, setEstablishment] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [resources, setResources] = useState<PronoteResource[]>([]);

  // Import state
  const [selectedResources, setSelectedResources] = useState<PronoteResource[]>(
    [],
  );
  const [currentPinSetupIndex, setCurrentPinSetupIndex] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  // Maps resource.id -> created childId for PIN store
  const [createdChildIds, setCreatedChildIds] = useState<
    Record<string, string>
  >({});

  const existingChildNames = children.map(toPronoteDedupeKey);

  // ---- Actions ----

  const handleBarCodeScanned = useCallback(
    ({ data }: { data: string }) => {
      if (step !== 'scan') return;

      const parsed = parseQrCode(data);
      if (!parsed) {
        setError('QR code invalide. Utilisez le QR de Pronote Espace Parents.');
        return;
      }

      setQrData(parsed);
      setEstablishment(extractEstablishment(parsed.url));
      setStep('pin');
      setError(null);
    },
    [step],
  );

  const handlePinSubmit = useCallback(async () => {
    if (!qrData || pin.length !== 4) {
      setError('Entrez le code PIN a 4 chiffres');
      return;
    }

    setError(null);
    setIsConnecting(true);

    try {
      const result = await pronote.connect(qrData, pin);

      if (result.error) {
        setError(result.error);
        setIsConnecting(false);
        return;
      }

      const foundResources = result.resources ?? [];

      if (foundResources.length === 0) {
        toast.warning(
          'Connexion reussie',
          "Votre compte Pronote est connecte, mais aucun enfant n'a ete trouve.",
        );
        router.back();
        return;
      }

      setResources(foundResources);
      setStep('import');
    } catch {
      setError('Erreur de connexion. Verifiez le code PIN.');
    } finally {
      setIsConnecting(false);
    }
  }, [qrData, pin, pronote, router, toast]);

  const handlePinReset = useCallback(() => {
    setStep('scan');
    setQrData(null);
    setPin('');
    setError(null);
  }, []);

  const handleImport = useCallback(
    async (selected: PronoteResource[]) => {
      if (selected.length === 0) {
        router.back();
        return;
      }

      setIsImporting(true);
      setError(null);

      try {
        const newChildIds: Record<string, string> = {};

        for (const resource of selected) {
          const { firstName, lastName } = splitPronoteName(resource.name);
          const baseUsername = pronoteUsername(resource.name);
          const username = `${baseUsername}.${Date.now() % 10000}`;

          // Cryptographically-random temporary password (128 bits of entropy).
          // Overwritten by the child's chosen PIN during the pin-setup step,
          // but must still be unguessable in case the parent abandons the flow
          // post-account-creation.
          const tempPassword = await generateTempPassword();

          const child = await createChild({
            firstName,
            lastName,
            username,
            password: tempPassword,
            schoolLevel: 'sixieme', // placeholder; updated in ChildPinSetup
          });

          newChildIds[resource.id] = child.id;

          // Set resource mapping for this child
          const resourceIndex = resources.indexOf(resource);
          if (resourceIndex !== -1) {
            pronote.setResourceMapping(child.id, resourceIndex);
          }
        }

        setCreatedChildIds(newChildIds);
        setSelectedResources(selected);
        setCurrentPinSetupIndex(0);
        setStep('pin-setup');
      } catch {
        toast.error('Erreur', 'Impossible de creer les comptes enfants.');
      } finally {
        setIsImporting(false);
      }
    },
    [resources, createChild, pronote, router, toast],
  );

  const handleChildPinComplete = useCallback(
    async (data: ChildPinData) => {
      const childId = createdChildIds[data.resource.id];
      if (childId) {
        await setCredential(childId, data.pinType, data.pinValue);
      }

      const nextIndex = currentPinSetupIndex + 1;
      if (nextIndex >= selectedResources.length) {
        toast.success(
          'Comptes crees',
          `${selectedResources.length} enfant(s) ajoute(s) avec succes.`,
        );
        router.back();
      } else {
        setCurrentPinSetupIndex(nextIndex);
      }
    },
    [
      createdChildIds,
      currentPinSetupIndex,
      selectedResources,
      setCredential,
      toast,
      router,
    ],
  );

  return {
    // State
    step,
    establishment,
    pin,
    error,
    isConnecting,
    resources,
    existingChildNames,
    selectedResources,
    currentPinSetupIndex,
    isImporting,

    // Setters
    setPin,

    // Actions
    handleBarCodeScanned,
    handlePinSubmit,
    handlePinReset,
    handleImport,
    handleChildPinComplete,
  };
}
