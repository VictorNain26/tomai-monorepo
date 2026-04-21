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

import { usePronote, useParentDashboard } from '@/hooks';
import { useUser } from '@/lib/auth';
import { useToast } from '@/components/ui/toast';
import { useChildAccessStore } from '@/stores/child-access-store';
import type {
  PronoteResource,
  QrCodeData,
} from '@/services/pronote/pronote-types';
import type { ChildPinData } from '@/hooks/usePronoteOnboarding';

// ============================================================================
// TYPES
// ============================================================================

export type ReconnectStep = 'scan' | 'pin' | 'import' | 'pin-setup';

export interface UsePronoteReconnectResult {
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

function parseQrCode(data: string): QrCodeData | null {
  try {
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (
      typeof parsed.jeton === 'string' &&
      typeof parsed.login === 'string' &&
      typeof parsed.url === 'string'
    ) {
      return { jeton: parsed.jeton, login: parsed.login, url: parsed.url };
    }
    return null;
  } catch {
    return null;
  }
}

function extractEstablishment(url: string): string {
  try {
    const match = url.match(/^https?:\/\/([^/:]+)/);
    if (match?.[1]) {
      return match[1].split('.')[0] || 'Mon etablissement';
    }
  } catch {
    // ignore
  }
  return 'Mon etablissement';
}

function toUsername(name: string): string {
  const combiningMarks = new RegExp('[\\u0300-\\u036f]', 'g');
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? fullName, lastName: '' };
  }
  // Pronote name format is typically "LASTNAME Firstname"
  const lastName = parts[0] ?? '';
  const firstName = parts.slice(1).join(' ');
  return { firstName, lastName };
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

  const existingChildNames = children.map(
    (c) => `${c.lastName} ${c.firstName}`.trim(),
  );

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
          const { firstName, lastName } = splitName(resource.name);
          const baseUsername = toUsername(resource.name);
          const username = `${baseUsername}.${Date.now() % 10000}`;

          // Temporary password — will be overwritten by PIN setup
          const tempPassword = `tmp-${Math.random().toString(36).slice(2)}`;

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
