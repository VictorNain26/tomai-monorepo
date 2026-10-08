# Plan — Les formules et la mise en forme de Tom, rendues dans la séance

## Problème

Tom écrit du Markdown et des formules KaTeX (`$…$`), que le prompt lui demande ; le web affiche
le texte brut, astérisques et dollars compris (`etudes/2026-10-08/interfaces.md`, constat 1). Le
prompt annonce aussi des schémas Mermaid que rien n'affiche.

## Choix

- **Streamdown 2.7** (Vercel, remplaçant de react-markdown fait pour le texte d'une IA) et
  **@streamdown/math** (KaTeX). Vérifiés le 2026-10-08 : dépôt actif (commit le 2026-10-07),
  8,1 M de téléchargements par semaine ; KaTeX actif (version 0.19 le 2026-10-01). Écart signalé :
  `remark-math` et `rehype-katex`, dont dépend `@streamdown/math`, n'ont plus de commit depuis
  février 2025 ; stables et très utilisés (10 M et 8,9 M par semaine).
- **Ni HTML brut, ni lien, ni image** venus du modèle : le texte de Tom n'en a pas besoin, et un
  enfant n'a pas à suivre un lien écrit par une IA.
- **Pas de Mermaid** : lourd sur téléphone, et il injecte des `<style>` en ligne que la CSP
  (`default-src 'self'`) refuse. Le prompt n'annonce plus que les formules.

## Critères d'acceptation

- [ ] Dans la séance, `**gras**` s'affiche en gras, `$\frac{3}{4}$` en fraction, sans astérisque
      ni dollar ; un lien, une image ou du HTML du modèle ne sont pas rendus (test e2e vu rouge).
- [ ] La CSP du serveur ne refuse rien sur la séance (KaTeX et ses polices).
- [ ] Le prompt ne mentionne plus Mermaid ; test vu rouge.

## Hors périmètre

Les schémas (à reprendre s'ils manquent en bêta, avec une solution compatible avec la CSP).

## Vérification de bout en bout

`bun run test`, Playwright `chat.spec.ts`, la séance vue dans Chrome avec une fraction.

## Décision humaine

Choix délégués par Victor le 2026-10-08.
