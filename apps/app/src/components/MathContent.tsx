/**
 * MathContent - Composant de rendu KaTeX pour contenu mathématique
 *
 * Utilisé pour rendre les formules LaTeX/KaTeX dans :
 * - Flashcards
 * - QCM
 * - Vrai/Faux
 * - Tout contenu éducatif avec formules
 *
 * Stack : react-markdown + remark-math + rehype-katex
 */

import { type ReactElement, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
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
        'math-content',
        textSize && textSizeClasses[textSize],
        centered && 'text-center',
        // Styles pour les éléments markdown générés
        '[&_p]:mb-0 [&_p:last-child]:mb-0',
        '[&_.katex-display]:my-2',
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // Évite les marges supplémentaires sur les paragraphes
          p: ({ children }) => <span className="inline">{children}</span>,
        }}
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
