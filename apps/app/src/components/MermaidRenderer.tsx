/**
 * Composant MermaidRenderer - Rendu de diagrammes Mermaid.js
 * Phase 1 Frontend : Support visualisations mathématiques
 * Utilise react-mermaid2 pour afficher diagrammes Gemini-generated
 */

import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { cn } from '@/lib/utils';

interface MermaidRendererProps {
  chart: string;
  className?: string;
}

/**
 * Composant pour rendre les diagrammes Mermaid.js
 * Utilisé par MessageRenderer pour les blocs ```mermaid
 */
export const MermaidRenderer = ({ chart, className }: MermaidRendererProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    const getThemeColors = () => {
      const style = getComputedStyle(document.documentElement);

      const hslToHex = (hsl: string): string => {
        const match = hsl.match(/(\d+\.?\d*)\s+(\d+\.?\d*)%\s+(\d+\.?\d*)%/);
        if (!match?.[1] || !match[2] || !match[3]) return '#000000';

        const h = parseFloat(match[1]);
        const s = parseFloat(match[2]) / 100;
        const l = parseFloat(match[3]) / 100;

        const c = (1 - Math.abs(2 * l - 1)) * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = l - c / 2;

        let r = 0, g = 0, b = 0;
        if (h >= 0 && h < 60) { r = c; g = x; b = 0; }
        else if (h >= 60 && h < 120) { r = x; g = c; b = 0; }
        else if (h >= 120 && h < 180) { r = 0; g = c; b = x; }
        else if (h >= 180 && h < 240) { r = 0; g = x; b = c; }
        else if (h >= 240 && h < 300) { r = x; g = 0; b = c; }
        else { r = c; g = 0; b = x; }

        const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      };

      const getColor = (varName: string, fallback: string): string => {
        return style.getPropertyValue(varName).trim() || fallback;
      };

      return {
        primaryColor: hslToHex(getColor('--primary', '224 84% 45%')),
        primaryTextColor: hslToHex(getColor('--primary-foreground', '0 0% 98%')),
        primaryBorderColor: hslToHex(getColor('--border', '0 0% 89.8%')),
        lineColor: hslToHex(getColor('--border', '0 0% 89.8%')),
        secondaryColor: hslToHex(getColor('--secondary', '142 85% 35%')),
        tertiaryColor: hslToHex(getColor('--accent', '271 85% 40%')),
        background: hslToHex(getColor('--card', '0 0% 100%')),
        mainBkg: hslToHex(getColor('--card', '0 0% 100%')),
        textColor: hslToHex(getColor('--card-foreground', '0 0% 8.5%')),
      };
    };

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      themeVariables: {
        ...getThemeColors(),
        fontSize: '14px',
      },
      fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
      securityLevel: 'strict',
    });

    const renderChart = async () => {
      if (!containerRef.current || !chart) return;

      try {
        setError(null);
        setIsRendered(false);

        // Générer ID unique pour éviter collisions
        const id = `mermaid-${Math.random().toString(36).substring(7)}`;

        // Rendre le diagramme avec Mermaid.js
        const { svg } = await mermaid.render(id, chart);

        // Injecter le SVG généré
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
          setIsRendered(true);
        }
      } catch (err) {
        // Erreur de rendu Mermaid (syntaxe invalide ou problème rendering)
        setError(err instanceof Error ? err.message : 'Erreur rendu diagramme');
      }
    };

    void renderChart();
  }, [chart]);

  if (error) {
    // Fallback si erreur : afficher le code brut avec message d'erreur
    return (
      <div className={cn("bg-destructive/10 border border-destructive/30 rounded-md p-3 mb-2", className)}>
        <p className="text-xs text-destructive font-semibold mb-1">⚠️ Erreur rendu diagramme</p>
        <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
          {chart}
        </pre>
        <p className="text-xs text-muted-foreground mt-1 italic">{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "mermaid-container bg-card border border-border rounded-md p-4 mb-2 overflow-x-auto",
        !isRendered && "animate-pulse bg-muted", // Loading state
        className
      )}
      aria-label="Diagramme mathématique"
    >
      {/* Le SVG sera injecté ici par Mermaid.js */}
    </div>
  );
};

export default MermaidRenderer;
