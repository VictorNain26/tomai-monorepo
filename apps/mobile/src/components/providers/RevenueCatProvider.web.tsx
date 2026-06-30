import { type ReactNode } from 'react';

/**
 * Variante web — react-native-purchases est natif-only.
 *
 * Sur le web l'IAP des stores n'existe pas ; ce provider est un pass-through
 * pour que l'app universelle monte sur web. La facturation web (RevenueCat
 * Web Billing) se branchera séparément, gated côté web, quand on l'attaquera.
 * Métro résout ce `.web.tsx` sur web et `RevenueCatProvider.tsx` (natif) sur mobile.
 */
export function RevenueCatProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
