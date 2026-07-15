# Charte graphique de l'app — direction artistique définitive

Date : 2026-07-07. Statut : spec validée en brainstorming, en attente de relecture.

« Tom » désigne uniquement l'IA/mascotte ; le nom de l'app est à trancher
(chantier branding séparé) — cette charte reste neutre sur le nom produit.

## Objectif

Trancher la direction artistique définitive de l'app (le chantier « DA future »
prévu par le design system unifié) et la livrer sous forme de charte graphique :
fondations visuelles + composants clés, **pas** de design de pages — à la seule
exception des 2 écrans de démonstration listés plus bas.

## Décisions de cadrage (tranchées avec Victor)

- **Une seule direction artistique**, présentée argumentée et défendue —
  l'exploration des variantes se fait en amont par Claude, Victor n'arbitre
  pas entre plusieurs planches. Itération sur feedback ensuite.
- **Périmètre charte** : palette sémantique (light + dark), typographie et
  échelle typographique, espacements/rayons, motion, iconographie, composants
  clés dans tous leurs états (Button, Card, Input/formulaire, Avatar, badge,
  toast, skeleton). Double registre sobre (parent/landing) / vivant (élève)
  démontré.
- **Deux écrans de démonstration seulement** : un écran élève (registre
  vivant) et un écran parent (registre sobre), pour prouver la charte en
  situation. Aucune autre page.
- **Hors périmètre** : logo, icône d'app, identité de marque hors produit,
  refonte structurelle des composants (on rhabille, on ne restructure pas),
  design des autres pages.
- **Outil de création** : planche HTML (artifact) — médium final, rendu
  fidèle, itération rapide. Pas d'atelier Figma (état de l'art 2026 :
  code-first quand le shipper est un dev et que les tokens sont la source de
  vérité).
- **Figma : optionnel, en sortie uniquement** — push de la charte finale sur
  un canvas via le MCP Figma (`generate_figma_design`, auth OAuth requise à ce
  moment-là), comme document partageable. Une passe, pas d'itération dans
  Figma.
- **Storybook : follow-up séparé** (hors chantier) — vitrine vivante des
  composants et de leurs états, aide à la vérification de parité DOM/RN.
  Standard dev-first éprouvé en monorepo Turborepo + react-native-web.

## Livrables

1. **Planche d'exploration** (artifact HTML, jetable) : charte complète —
   fondations, composants tous états, 2 écrans de démo — en light et dark,
   construite sur des variables CSS nommées comme les tokens de
   `@repo/tokens`. Boucle de validation avec Victor dans le navigateur.
2. **PR `@repo/tokens`** une fois la direction validée : swap des valeurs
   (couleurs, typo si elle change, espacements/rayons/motion si ajustés),
   miroirs TS mis à jour (tests existants), parité vérifiée sur les composants
   homonymes (`packages/ui` et `apps/mobile/src/components/ui`) en relisant
   leurs variants côte à côte.
3. **Documentation** : `docs/design/design-system.md` mis à jour (la section
   tokens reflète la DA tranchée), plus une page charte
   `docs/design/charte-graphique.md` si le contenu déborde du contrat
   existant.
4. **(Optionnel)** canvas Figma de référence via MCP.

## Contraintes

- `@repo/tokens` reste l'unique source de vérité — la charte est un swap de
  valeurs, aucun mécanisme nouveau (le double registre reste une convention
  d'usage, sauf si la DA exige une surcouche de variables, prévu par le
  contrat).
- Registre élève : vivant sans infantiliser (pas de mascotte cartoon, pas de
  formes enfantines). A11y AA : contraste 4.5:1 sur toutes les paires de la
  palette.
- Public : élèves 11-18 ans (utilisateurs), parents (payeurs), positionnement
  EU/RGPD.

## Architecture / flux

Planche HTML (exploration, jetable) → validation Victor (itérations) →
PR tokens + docs (livraison, durable) → Figma (optionnel, archivage).

## Tests / validation

- Miroirs TS de `@repo/tokens` : tests existants passent après swap.
- Contrastes AA vérifiés (outil de calcul, pas à l'œil) pour chaque paire
  fond/texte de la palette light et dark.
- Validation monorepo standard : typecheck + lint + tests des apps touchées.

## Follow-ups notés (hors périmètre)

- Chantier Storybook (vitrine composants + parité DOM/RN).
- Logo / icône d'app (designer humain ou chantier dédié).
