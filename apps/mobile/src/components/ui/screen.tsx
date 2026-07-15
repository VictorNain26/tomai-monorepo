/**
 * Screen - safe-area wrapper unique de l'app.
 *
 * Source de vérité pour les insets : applique le padding via `useSafeAreaInsets`
 * (recommandé par React Navigation plutôt que `SafeAreaView` pour le contenu).
 *
 * Règle d'edges :
 * - Écran DANS un navigator à tabs → `['top']` (défaut) : la tab bar réserve déjà
 *   l'inset bas (React Navigation réduit `insets.bottom`→0 sous une tab).
 * - Écran plein-écran HORS-tab (présenté en stack, modals) → `['top','bottom']`.
 * - Hero full-bleed passant sous la status bar → `['bottom']`.
 */

import { type ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { cn } from '@/lib/utils';

type Edge = 'top' | 'bottom';

interface ScreenProps {
  children: ReactNode;
  /** Insets à appliquer en padding. Défaut `['top']`. */
  edges?: Edge[];
  className?: string;
  testID?: string;
}

export function Screen({ children, edges = ['top'], className, testID }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      testID={testID}
      className={cn('flex-1 bg-background', className)}
      style={{
        paddingTop: edges.includes('top') ? insets.top : 0,
        paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
      }}
    >
      {children}
    </View>
  );
}
