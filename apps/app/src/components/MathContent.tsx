/**
 * MathContent - Composant de rendu enrichi pour contenu éducatif
 *
 * Utilisé pour rendre du contenu riche dans les cartes :
 * - Formules KaTeX ($...$ ou $$...$$)
 * - Tableaux Markdown (GFM)
 * - Diagrammes Mermaid (```mermaid)
 * - Listes, code, et texte formaté
 *
 * Stack : react-markdown + remark-math + remark-gfm + rehype-katex + mermaid
 */

import { type ReactElement, memo, useEffect, useRef, useState, useId } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import type { Mermaid } from 'mermaid';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

// ============================================================================
// MERMAID LAZY LOADING + DARK MODE
// ============================================================================

let mermaidInstance: Mermaid | null = null;
let mermaidInitialized = false;

/**
 * Lazy-load et initialise Mermaid une seule fois
 * Évite les problèmes SSR et optimise le bundle
 */
async function getMermaid(isDark: boolean): Promise<Mermaid> {
  if (!mermaidInstance) {
    const mermaidModule = await import('mermaid');
    mermaidInstance = mermaidModule.default;
  }

  const instance = mermaidInstance;

  // Réinitialiser si le thème change
  const theme = isDark ? 'dark' : 'neutral';

  if (!mermaidInitialized && instance) {
    instance.initialize({
      startOnLoad: false,
      theme,
      securityLevel: 'strict', // Sécurité renforcée
      fontFamily: 'inherit',
    });
    mermaidInitialized = true;
  }

  return instance;
}

/**
 * Détecte le mode sombre du système/app
 */
function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Vérifier la classe sur documentElement (TailwindCSS dark mode)
    const checkDark = () => {
      const hasDarkClass = document.documentElement.classList.contains('dark');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(hasDarkClass || prefersDark);
    };

    checkDark();

    // Observer les changements de classe
    const observer = new MutationObserver(checkDark);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    // Observer les changements de préférence système
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDark);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDark);
    };
  }, []);

  return isDark;
}

// ============================================================================
// MERMAID DIAGRAM COMPONENT
// ============================================================================

interface MermaidDiagramProps {
  chart: string;
}

function MermaidDiagram({ chart }: MermaidDiagramProps): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const uniqueId = useId().replace(/:/g, '-');
  const isDark = useIsDarkMode();

  useEffect(() => {
    let cancelled = false;

    async function renderChart() {
      if (!containerRef.current) return;

      try {
        setIsLoading(true);
        const mermaid = await getMermaid(isDark);

        if (cancelled) return;

        const { svg: renderedSvg } = await mermaid.render(
          `mermaid-${uniqueId}`,
          chart
        );

        if (cancelled) return;

        setSvg(renderedSvg);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Erreur de rendu');
        setSvg('');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void renderChart();

    return () => { cancelled = true; };
  }, [chart, uniqueId, isDark]);

  if (isLoading) {
    return (
      <div className="my-3 flex justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 p-2 rounded my-2">
        Erreur diagramme: {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="my-3 flex justify-center overflow-x-auto [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// ============================================================================
// MATH CONTENT COMPONENT
// ============================================================================

interface MathContentProps {
  /** Contenu texte avec formules KaTeX, tableaux, et diagrammes Mermaid */
  content: string;
  /** Classes CSS additionnelles */
  className?: string;
  /** Taille du texte (hérite les styles parent par défaut) */
  textSize?: 'sm' | 'base' | 'lg' | 'xl' | '2xl';
  /** Centrer le contenu */
  centered?: boolean;
}

const textSizeClasses = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
  '2xl': 'text-2xl',
} as const;

/**
 * Custom components pour react-markdown
 * Gère les blocs de code Mermaid spécialement
 */
const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? '');
    const language = match ? match[1] : null;

    // Diagramme Mermaid
    if (language === 'mermaid') {
      const chartCode = String(children).replace(/\n$/, '');
      return <MermaidDiagram chart={chartCode} />;
    }

    // Code inline ou bloc normal
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
};

/**
 * Rend du contenu enrichi : KaTeX, tableaux, diagrammes Mermaid
 *
 * @example
 * // Formule inline
 * <MathContent content="L'aire est $A = \pi r^2$" />
 *
 * @example
 * // Diagramme Mermaid
 * <MathContent content="```mermaid\ngraph TD\n  A-->B\n```" />
 */
function MathContentComponent({
  content,
  className,
  textSize,
  centered = false,
}: MathContentProps): ReactElement {
  return (
    <div
      className={cn(
        'math-content prose prose-sm dark:prose-invert max-w-none',
        textSize && textSizeClasses[textSize],
        centered && 'text-center',
        // Styles pour les éléments markdown générés
        '[&_p]:mb-2 [&_p:last-child]:mb-0',
        '[&_.katex-display]:my-2',
        // Styles pour les tableaux GFM
        '[&_table]:w-full [&_table]:border-collapse [&_table]:my-2',
        '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:bg-muted [&_th]:font-medium [&_th]:text-left',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        // Styles pour les listes
        '[&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1',
        '[&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1',
        '[&_li]:my-0.5',
        // Styles pour le code
        '[&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs',
        '[&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto [&_pre]:text-xs [&_pre]:my-2',
        // Bold/italic
        '[&_strong]:font-semibold',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Version mémoïsée pour éviter les re-renders inutiles
 * Le contenu mathématique est généralement statique
 */
export const MathContent = memo(MathContentComponent);
