/**
 * MathContent - Composant de rendu KaTeX pour contenu mathématique
 *
 * Utilisé pour rendre les formules LaTeX/KaTeX dans :
 * - Flashcards
 * - QCM
 * - Vrai/Faux
 * - Tout contenu éducatif avec formules
 *
 * Stack : react-markdown + remark-math + remark-gfm + rehype-katex
 */

import { type ReactElement, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { cn } from '@/lib/utils';

interface MathContentProps {
  /** Contenu texte avec potentielles formules KaTeX ($...$ ou $$...$$) */
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
 * Rend du contenu texte avec support KaTeX pour les formules mathématiques
 *
 * @example
 * // Formule inline
 * <MathContent content="L'aire est $A = \pi r^2$" />
 *
 * @example
 * // Formule display (centrée)
 * <MathContent content="$$x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}$$" />
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
