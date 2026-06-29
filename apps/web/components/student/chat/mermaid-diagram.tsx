"use client";

import { useEffect, useId, useState } from "react";

let initialized = false;

async function getMermaid() {
  const mermaid = (await import("mermaid")).default;
  if (!initialized) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      theme: "default",
      fontFamily: "inherit",
      // Taille naturelle du schéma (sinon il est écrasé pour tenir dans la
      // bulle, rendant les frises illisibles) ; le conteneur scrolle en X.
      flowchart: { useMaxWidth: false },
    });
    initialized = true;
  }
  return mermaid;
}

/**
 * Rend un bloc ```mermaid``` en SVG côté client. `securityLevel: 'strict'`
 * neutralise le HTML/script dans les libellés, donc le SVG injecté est sûr.
 *
 * Pendant le streaming, le bloc arrive incomplet et `render` échoue ; on
 * réessaie à chaque mise à jour de `chart` et on n'affiche le repli (code brut)
 * que tant qu'aucun SVG valide n'a été produit — sinon le diagramme final
 * resterait masqué par un échec transitoire.
 */
export function MermaidDiagram({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const renderId = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const mermaid = await getMermaid();
        const { svg } = await mermaid.render(renderId, chart);
        if (active) setSvg(svg);
      } catch {
        if (active) setFailed(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [chart, renderId]);

  // SVG d'abord : une fois un rendu valide obtenu, on l'affiche même si une
  // tentative ultérieure (rare) échoue. Surface blanche fixe pour rester
  // lisible quel que soit le thème (le thème mermaid "default" est clair).
  if (svg) {
    return (
      <div
        className="my-3 overflow-x-auto rounded-lg border border-border bg-white p-3"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }

  if (failed) {
    return (
      <code className="my-2 block overflow-x-auto rounded-lg bg-foreground/5 p-3 font-mono text-xs leading-relaxed">
        {chart}
      </code>
    );
  }

  return <div className="my-2 text-xs text-muted-foreground">Schéma…</div>;
}
