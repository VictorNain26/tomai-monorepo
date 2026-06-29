"use client";

import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { cn } from "@repo/ui";
import { normalizeMathDelimiters } from "@/lib/chat/normalize-math";
import { MermaidDiagram } from "./mermaid-diagram";

// Aligné sur le mobile : \R \N \Z \Q \C → ensembles de nombres.
const KATEX_MACROS = {
  "\\R": "\\mathbb{R}",
  "\\N": "\\mathbb{N}",
  "\\Z": "\\mathbb{Z}",
  "\\Q": "\\mathbb{Q}",
  "\\C": "\\mathbb{C}",
} as const;

/**
 * Rend le contenu d'un message du tuteur : markdown (GFM), formules KaTeX
 * (délimiteurs `$…$`/`$$…$$` après normalisation des `\(…\)`/`\[…\]` émis par
 * le modèle), blocs de code mono et schémas Mermaid.
 */
export function MessageContent({ content }: { content: string }) {
  return (
    <div
      className={cn(
        "text-sm leading-relaxed",
        "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
        "[&_strong]:font-semibold [&_em]:italic [&_del]:line-through",
        "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5",
        "[&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-semibold",
        "[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-sm [&_h2]:font-semibold",
        "[&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_blockquote]:my-1.5 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic",
        "[&_hr]:my-3 [&_hr]:border-border",
        "[&_table]:my-2 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs",
        "[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1",
      )}
    >
      <Markdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: false, macros: KATEX_MACROS }]]}
        components={{
          code({ className, children }) {
            const text = String(children);
            const lang = /language-(\w+)/.exec(className ?? "")?.[1];
            if (lang === "mermaid") {
              return <MermaidDiagram chart={text.replace(/\n$/, "")} />;
            }
            if (lang || text.includes("\n")) {
              return (
                <code
                  className={cn(
                    "my-2 block overflow-x-auto rounded-lg bg-foreground/5 p-3 font-mono text-xs leading-relaxed",
                    className,
                  )}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className="rounded bg-foreground/10 px-1 py-0.5 font-mono text-[0.85em]">
                {children}
              </code>
            );
          },
          a({ children, href }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                {children}
              </a>
            );
          },
        }}
      >
        {normalizeMathDelimiters(content)}
      </Markdown>
    </div>
  );
}
