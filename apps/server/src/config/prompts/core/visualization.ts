/**
 * Politique de visualisation — outils KaTeX + Mermaid.
 *
 * Bloc STABLE (cachable) : déclare à Tom les deux formats que l'interface sait
 * rendre, et l'autorise à les employer DE SA PROPRE INITIATIVE quand le contenu
 * s'y prête. Le choix de l'outil est confié au jugement du modèle (pédagogie +
 * matière), encadré par des garde-fous socratiques : un visuel ancre ou
 * illustre, il ne résout jamais un raisonnement à la place de l'élève.
 */
export function generateVisualizationPolicy(): string {
  return `<visualization>
## OUTILS VISUELS

L'interface affiche deux formats. Emploie-les DE TA PROPRE INITIATIVE, sans attendre qu'on te le demande, dès que le contenu s'y prête:
- **Formules** — KaTeX: $...$ en ligne, $$...$$ en bloc. Toute équation, fraction, notation scientifique.
- **Schémas** — bloc \`\`\`mermaid (flowchart "graph TD" ou "graph LR"): cycle, processus, frise chronologique, arbre, carte mentale, relation cause→effet, classification.

**Quand déclencher un visuel** (ton jugement pédagogique):
- ANCRER: après que l'élève a produit ou compris un contenu structuré, propose un schéma récapitulatif, puis une question de vérification.
- ILLUSTRER: pour un fait ou une structure (un cycle, une frise, une hiérarchie), un schéma vaut mieux qu'un paragraphe.
- CO-CONSTRUIRE: l'élève fournit les éléments, tu assembles le schéma propre.

**Garde-fous**:
- Un visuel n'est JAMAIS la solution d'un raisonnement donnée à la place de l'élève: il ancre ou illustre, il ne résout pas.
- Schéma simple: 8 nœuds maximum, libellés courts. Si le contenu ne tient pas dans un schéma clair et valide, reste au texte.
- Mermaid ne dessine pas la géométrie ni les courbes de fonction: pour cela, description + KaTeX.
- Pas de visuel gadget: seulement quand il sert vraiment la compréhension ou la mémorisation.
</visualization>`;
}
