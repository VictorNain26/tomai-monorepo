/**
 * usePronoteOnboarding Hook
 *
 * State machine for the multi-step Pronote onboarding flow shown to parents
 * with 0 children on first login.
 *
 * Step transitions :
 *   welcome -> scan -> pin -> import -> pin-setup -> parent-pin -> parent-pin-confirm -> done
 *
 * Each step owns its own local state (QR payload, PIN value, etc.) and the
 * hook exposes discrete action callbacks that the screen / step components
 * can invoke. No React Query here : Pronote session and credential storage
 * are handled by `usePronote` + `useChildAccessStore` + `useParentDashboard`.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'expo-router';

import { usePronote, useParentDashboard } from '@/hooks';
import { useUser } from '@/lib/auth';
import { useChildAccessStore } from '@/stores/child-access-store';
import type {
  PronoteResource,
  QrCodeData,
} from '@/services/pronote/pronote-types';
import type { EducationLevelType } from '@/constants/levels';
import type { ICreateChildData } from '@/hooks/useParentDashboard';

// ============================================================================
// TYPES
// ============================================================================

export type OnboardingStep =
  | 'welcome'
  | 'scan'
  | 'pin'
  | 'import'
  | 'pin-setup'
  | 'parent-pin'
  | 'parent-pin-confirm';

export interface ChildPinData {
  resource: PronoteResource;
  schoolLevel: EducationLevelType;
  pinType: 'pin' | 'password';
  pinValue: string;
}

export interface UsePronoteOnboardingResult {
  // ---- State ----
  step: OnboardingStep;
  qrData: QrCodeData | null;
  establishment: string;
  pin: string;
  error: string | null;
  isConnecting: boolean;
  resources: PronoteResource[];
  existingChildNames: string[];
  selectedResources: PronoteResource[];
  currentPinSetupIndex: number;
  isCreatingChildren: boolean;
  parentPinValue: string;
  parentPinConfirm: string;
  isSavingParentPin: boolean;

  // ---- Setters (direct, for controlled inputs) ----
  setPin: (value: string) => void;
  setParentPinValue: (value: string) => void;
  setParentPinConfirm: (value: string) => void;

  // ---- Actions (state transitions) ----
  goToScan: () => void;
  handleBarCodeScanned: (result: { data: string }) => void;
  handlePinSubmit: () => Promise<void>;
  handlePinReset: () => void;
  handleImport: (selected: PronoteResource[]) => void;
  handleChildPinComplete: (data: ChildPinData) => Promise<void>;
  handleParentPinSubmit: () => void;
  handleParentPinConfirm: () => Promise<void>;
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

function generateUsername(name: string): string {
  // Remove combining diacritical marks (U+0300 - U+036F).
  const combiningMarks = new RegExp('[\\u0300-\\u036f]', 'g');
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(combiningMarks, '')
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9.]/g, '');
}

// ============================================================================
// HOOK
// ============================================================================

export function usePronoteOnboarding(): UsePronoteOnboardingResult {
  const router = useRouter();
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const { createChild, children } = useParentDashboard();
  const setCredential = useChildAccessStore((s) => s.setCredential);
  const setParentCredential = useChildAccessStore((s) => s.setParentCredential);

  // Flow state
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [qrData, setQrData] = useState<QrCodeData | null>(null);
  const [establishment, setEstablishment] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [resources, setResources] = useState<PronoteResource[]>([]);

  // Child import state
  const [selectedResources, setSelectedResources] = useState<PronoteResource[]>(
    [],
  );
  const [childPinData, setChildPinData] = useState<ChildPinData[]>([]);
  const [currentPinSetupIndex, setCurrentPinSetupIndex] = useState(0);
  const [isCreatingChildren, setIsCreatingChildren] = useState(false);

  // Parent PIN state
  const [parentPinValue, setParentPinValue] = useState('');
  const [parentPinConfirm, setParentPinConfirm] = useState('');
  const [isSavingParentPin, setIsSavingParentPin] = useState(false);

  const existingChildNames = children.map(
    (c) => `${c.firstName} ${c.lastName}`,
  );

  // ---- Actions ----

  const goToScan = useCallback(() => {
    setStep('scan');
    setError(null);
  }, []);

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
      setResources(foundResources);

      if (foundResources.length === 0) {
        setError('Aucun enfant trouve dans votre compte Pronote.');
        setIsConnecting(false);
        return;
      }

      setStep('import');
    } catch {
      setError('Erreur de connexion. Verifiez le code PIN.');
    } finally {
      setIsConnecting(false);
    }
  }, [qrData, pin, pronote]);

  const handlePinReset = useCallback(() => {
    setStep('scan');
    setQrData(null);
    setPin('');
    setError(null);
  }, []);

  const handleImport = useCallback((selected: PronoteResource[]) => {
    setSelectedResources(selected);
    setCurrentPinSetupIndex(0);
    setChildPinData([]);
    setStep('pin-setup');
  }, []);

  const handleChildPinComplete = useCallback(
    async (data: ChildPinData) => {
      const updatedData = [...childPinData, data];
      setChildPinData(updatedData);

      if (currentPinSetupIndex < selectedResources.length - 1) {
        setCurrentPinSetupIndex((i) => i + 1);
        return;
      }

      // All children configured — create accounts
      setIsCreatingChildren(true);
      setError(null);

      try {
        for (const child of updatedData) {
          const nameParts = child.resource.name.split(' ');
          const firstName = nameParts[0] || child.resource.name;
          const lastName = nameParts.slice(1).join(' ') || '';

          const childData: ICreateChildData = {
            firstName,
            lastName,
            username: generateUsername(child.resource.name),
            password: child.pinValue,
            schoolLevel: child.schoolLevel,
          };

          const created = await createChild(childData);

          // Store child PIN locally
          await setCredential(created.id, child.pinType, child.pinValue);

          // Set Pronote resource mapping
          const resourceIndex = resources.findIndex(
            (r) => r.id === child.resource.id,
          );
          if (resourceIndex >= 0) {
            pronote.setResourceMapping(created.id, resourceIndex);
          }
        }

        setStep('parent-pin');
      } catch {
        setError('Erreur lors de la creation des comptes. Reessayez.');
      } finally {
        setIsCreatingChildren(false);
      }
    },
    [
      childPinData,
      currentPinSetupIndex,
      selectedResources.length,
      createChild,
      setCredential,
      resources,
      pronote,
    ],
  );

  const handleParentPinSubmit = useCallback(() => {
    if (parentPinValue.length < 4) return;
    setError(null);
    setStep('parent-pin-confirm');
  }, [parentPinValue]);

  const handleParentPinConfirm = useCallback(async () => {
    if (parentPinConfirm !== parentPinValue) {
      setError('Les codes ne correspondent pas');
      return;
    }

    setIsSavingParentPin(true);
    setError(null);

    try {
      await setParentCredential(parentPinValue);
      router.replace('/(parent)/profile-select');
    } catch {
      setError('Erreur lors de la sauvegarde. Reessayez.');
    } finally {
      setIsSavingParentPin(false);
    }
  }, [parentPinConfirm, parentPinValue, setParentCredential, router]);

  return {
    // State
    step,
    qrData,
    establishment,
    pin,
    error,
    isConnecting,
    resources,
    existingChildNames,
    selectedResources,
    currentPinSetupIndex,
    isCreatingChildren,
    parentPinValue,
    parentPinConfirm,
    isSavingParentPin,

    // Setters
    setPin,
    setParentPinValue,
    setParentPinConfirm,

    // Actions
    goToScan,
    handleBarCodeScanned,
    handlePinSubmit,
    handlePinReset,
    handleImport,
    handleChildPinComplete,
    handleParentPinSubmit,
    handleParentPinConfirm,
  };
}
