/**
 * E2E stubs for the Pronote onboarding UI flow (EXPO_PUBLIC_E2E=1, preview only).
 * These deterministic fixtures replace QR scan / discovery / activation so the
 * UI can be driven by Maestro. They DO NOT exercise real Pronote connectivity —
 * that is verified separately by the server live test (apps/server/src/live/pronote.test.ts),
 * which exercises a real Pronote account via PRONOTE_TEST_* env vars.
 */

// E2E ONLY — deterministic fixtures for Maestro preview-android flows.
// This module is a dead export unless EXPO_PUBLIC_E2E === '1'.
// Production builds never set that flag (gated in eas.json preview profile only).

import type { DiscoveredChild } from '@/hooks/usePronoteConnect';

// Fixed test QR payload injected by the e2e-inject-qr element.
// Well-formed shape, clearly-fake values — not a real Pronote credential.
export const E2E_QR_PAYLOAD = {
  jeton: 'e2e-test-jeton-00000000',
  login: 'e2e-test-login@college-demo.fr',
  url: 'https://college-demo.index-education.net/pronote/',
};

export const E2E_CREDENTIAL_ID = 'e2e-cred-00000000';

export const E2E_DISCOVERED: DiscoveredChild[] = [
  {
    resourceId: 0,
    name: 'DEMO Eleve',
    className: '3eme A',
    establishmentName: 'College Demo',
    suggested: {
      firstName: 'Demo',
      lastName: 'Eleve',
      schoolLevel: 'troisieme',
    },
    existingChildId: null,
  },
];

export const E2E_ACTIVATE_RESULT = {
  activated: [{ resourceId: 0, childId: 'e2e-child-00000000' }],
  failed: [],
};
