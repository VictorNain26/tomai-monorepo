import ReactMarkdown, { type Components } from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { useEffect, useRef } from 'react';
import { useAudio } from '@/lib/audioHooks';
import { cn } from '@/lib/utils';
import MermaidRenderer from './MermaidRenderer';
import { ThinkingIndicator } from './chat/atoms/ThinkingIndicator';
import { StreamingCursor } from './chat/atoms/StreamingCursor';

interface MessageRendererProps {
  content: string;
  messageId: string;
  isUser: boolean;
  isThinking?: boolean;
  isStreaming?: boolean;
  autoSpeak?: boolean;
}

const MessageRenderer = ({
  content,
  messageId,
  isUser,
  isThinking,
  isStreaming,
  autoSpeak = false
}: MessageRendererProps) => {
  const audio = useAudio();
  const hasBeenSpokenRef = useRef(false);

  // Auto-speak pour les messages IA uniquement quand complet (pas pendant thinking/streaming)
  useEffect(() => {
    if (!isUser && autoSpeak && content && !isThinking && !isStreaming && !hasBeenSpokenRef.current && audio.isSupported) {
      const timer = setTimeout(async () => {
        try {
          await audio.speakMessage(messageId, content);
          hasBeenSpokenRef.current = true;
        } catch {
          // Erreur gérée par AudioManager
        }
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [content, messageId, isUser, autoSpeak, isThinking, isStreaming, audio]);

  // Indicateur "Tom réfléchit..." pendant l'attente de la première réponse
  if (isThinking) {
    return <ThinkingIndicator />;
  }

  // Composants personnalisés pour préserver le design shadcn/ui
  const components: Components = {
    // Titres - Styles éducatifs adaptés
    h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mb-2 mt-3 first:mt-0">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2 mt-3 first:mt-0">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mb-1 mt-2 first:mt-0">{children}</h3>,

    // Paragraphes - Préserve l'espacement naturel
    p: ({ children }) => <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>,

    // Listes - Style éducatif clair
    ul: ({ children }) => <ul className="text-sm leading-relaxed mb-2 pl-4 list-disc space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="text-sm leading-relaxed mb-2 pl-4 list-decimal space-y-1">{children}</ol>,
    li: ({ children }) => <li className="text-sm">{children}</li>,

    // Code - Style distinctif pour exemples + support Mermaid.js (Phase 1 Frontend)
    code: ({ children, className }) => {
      const isInline = !className?.includes('language-');

      // Inline code (ex: `x = 5`)
      if (isInline) {
        return <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>;
      }

      // Détection blocs Mermaid.js pour diagrammes mathématiques
      const isMermaid = className?.includes('language-mermaid');
      if (isMermaid) {
        const chartCode = String(children).replace(/\n$/, ''); // Retirer trailing newline
        return <MermaidRenderer chart={chartCode} />;
      }

      // Code blocks classiques (Python, JavaScript, etc.)
      return (
        <code className={cn("block bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto mb-2", className)}>
          {children}
        </code>
      );
    },

    // Blocs de code
    pre: ({ children }) => <div className="mb-2">{children}</div>,

    // Emphases - Cohérent avec le design
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,

    // Citations - Style éducatif
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary/30 pl-4 my-2 text-sm italic text-muted-foreground">
        {children}
      </blockquote>
    ),
  };

  return (
    <div className={isUser ? 'text-primary-foreground' : 'text-card-foreground'}>
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
      {/* Curseur clignotant pendant le streaming */}
      {isStreaming && <StreamingCursor />}
    </div>
  );
};

export default MessageRenderer;
