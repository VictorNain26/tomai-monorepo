import { useCallback, useEffect, useState } from 'react';

/**
 * Hook pour gestion KaTeX CSS - 2025 Best Practices
 * Détection CSS existant + injection fallback + logging explicite
 */
export function useKatex() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Vérifier si KaTeX CSS est déjà chargé (via bundler ou CDN)
  const checkKatexCSS = useCallback(() => {
    // Vérifier si les styles KaTeX sont présents
    const hasKatexStyles = Array.from(document.styleSheets).some(sheet => {
      try {
        return sheet.href?.includes('katex') ??
               Array.from(sheet.cssRules ?? []).some(rule =>
                 rule.cssText?.includes('.katex')
               );
      } catch {
        return false;
      }
    });

    if (hasKatexStyles) {
      setIsLoaded(true);
      return true;
    }
    return false;
  }, []);

  const loadKatex = useCallback(() => {
    if (isLoaded || hasError) return;

    // 1. Vérifier d'abord si déjà chargé
    if (checkKatexCSS()) {
      return;
    }

    // 2. Créer élément link vers CDN (plus fiable que dynamic import)
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css';
    link.crossOrigin = 'anonymous';

    link.onload = () => {
      setIsLoaded(true);
      // CSS loaded successfully from CDN
    };

    link.onerror = () => {
      setHasError(true);
      // CSS failed to load from CDN
      // Fallback : essayer avec styles inline minimaux
      const fallbackStyle = document.createElement('style');
      fallbackStyle.textContent = `
        .katex { font-family: KaTeX_Main, "Times New Roman", serif; }
        .katex-display { text-align: center; margin: 1em 0; }
        .katex .mord { color: inherit; }
      `;
      document.head.appendChild(fallbackStyle);
      setIsLoaded(true);
      // Fallback styles applied
    };

    // Éviter les doublons
    if (!document.querySelector('link[href*="katex"]')) {
      document.head.appendChild(link);
    }
  }, [isLoaded, hasError, checkKatexCSS]);

  useEffect(() => {
    // Chargement immédiat + vérification existant
    if (!checkKatexCSS()) {
      loadKatex();
    }
  }, [checkKatexCSS, loadKatex]);

  return { isLoaded, hasError, loadKatex };
}
