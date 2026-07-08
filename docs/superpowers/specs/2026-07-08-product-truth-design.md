# Doc produit « source de vérité » — design

Date : 2026-07-08. Statut : design validé en brainstorming, en attente de relecture.

## Objectif

Créer `docs/product/product-truth.md` : la **source de vérité produit** de TomIA.
Il décrit chaque fonctionnalité — livrée, en cours, décidée, envisagée — par son
comportement utilisateur et les règles produit qui la gouvernent. Il comble le trou
actuel : la vision fonctionnelle vit éclatée entre le code, les audits datés et la
mémoire de session.

## Décisions de cadrage (tranchées avec Victor)

- **Rôle** : source de vérité produit, doc vivant. Paire explicite avec
  `docs/architecture/system-design.md` : lui dit *comment c'est construit*,
  celui-ci dit *ce que le produit fait et fera*. Chacun référence l'autre en tête.
- **Granularité** : comportement détaillé — chaque fiche est assez précise pour
  cadrer un chantier sans re-brainstormer de zéro (15-25 pages assumées).
- **Périmètre** : tout le décidé (livré / en cours / prévu) **+** une section
  d'idées non tranchées, proposées et défendues, chacune avec un verdict à
  prendre par Victor.
- **Carte blanche** : le doc ne photographie pas l'existant, il le **remet en
  question**. Toute décision produit existante que je conteste porte un encadré
  **« ⚠️ Position »** : argumentaire + verdict à prendre. Rien n'est réécrit
  comme acquis tant que Victor n'a pas tranché — le doc distingue toujours le
  *décidé* du *contesté*. Premier cas identifié : l'abonnement (IAP mobile-only
  hérité d'avant l'app universelle ↔ besoin de s'abonner sur web ET mobile).
- **Nommage** (Victor, 2026-07-08) : le branding complet est à revoir — le nom
  de l'app n'est pas choisi ; **« Tom » désigne uniquement l'IA/mascotte** avec
  laquelle l'élève parle. Le doc désigne le produit de façon neutre (« l'app »),
  réserve « Tom » au chatbot, et porte « nom de l'app : à trancher (chantier
  branding, avec mascotte) » comme décision ouverte dans la matrice.

## Structure du document

1. **Le produit en une page** + matrice de statut globale (toutes les
   fonctionnalités × statut, vue d'ensemble en 30 secondes).
2. **Parcours élève** (narratif, ~1 page) — « une semaine de Léa, 4e » ;
   distingue typographiquement ce qui existe (présent) de ce qui vient
   (« à terme… »).
3. **Parcours parent** (narratif, ~1 page) — même principe.
4. **8 fiches domaine** :
   - Chat & pédagogie (protocole socratique complet, adaptation niveau/matière,
     mémoire élève par matière, RAG programmes officiels, contexte Pronote,
     photo d'exercice, quotas, sécurité mineurs)
   - Révisions & mémorisation (flashcards depuis le chat, répétition espacée FSRS)
   - Vie scolaire — Pronote (connexion QR, notes/devoirs/EDT, optionnel,
     natif-only ; WebView ENT 🎯)
   - Vocal (push-to-talk livré, comportement oral par matière ; temps réel 🎯)
   - Fichiers & documents (upload, photo/OCR, usage dans le chat)
   - Comptes & supervision (parent crée les comptes élèves — username sans
     email, RGPD mineurs —, dashboard parent, reset parent)
   - Abonnement & modèle éco (quotas free/premium ; ⚠️ Position sur le web billing)
   - Plateformes & reach (app universelle 🎯 lot 5, landing waitlist, B2B 💡)
5. **Idées défendues** — 5 à 8 maximum, non tranchées.

## Template de fiche domaine (uniforme)

- **Promesse** — la fonctionnalité en une phrase, côté utilisateur.
- **Comportement** — le détail : ce que vit l'élève/le parent, les règles
  produit, les cas limites décidés. Le gros de la fiche.
- **Statut** — ✅ livré / 🔨 en cours / 🎯 décidé non démarré / 💡 envisagé,
  à la granularité sous-fonctionnalité (ex. Pronote : QR ✅, WebView ENT 🎯).
- **Plateformes** — natif / web / les deux, et les dégradations volontaires.
- **Décisions & renvois** — arbitrages qui gouvernent la fiche (liens
  ADR/audits), jamais paraphrasés.
- **⚠️ Position** *(facultatif)* — remise en question argumentée d'une décision
  existante, verdict à prendre.

## Template d'idée défendue

Pitch (3 lignes) + pourquoi (preuve : matière produit/marché des audits de
juin 2026 + recherche concurrentielle fraîche faite à la rédaction) +
coût/risque + verdict à prendre. Candidates déjà identifiées : résumés
d'activité hebdo parents, limites de temps d'usage, mode révision d'examen
(brevet/bac), gamification saine (streaks sans dark patterns). La recherche
fraîche peut en ajouter ou en tuer.

## Frontières et règles

- **Zéro contenu technique** : pas de stack, pas de noms de services, pas
  d'archi. Une phrase qui parle d'Elysia ou de Qdrant est dans le mauvais doc.
- **Méthode d'extraction** : le comportement « livré » est extrait du **code
  réel** (prompts système, services, règles de quotas), pas de la mémoire ni
  des vieux docs. C'est la condition du titre « source de vérité ».
- **Maintenance** : les statuts se mettent à jour à chaque merge de chantier
  (seul champ volatil) ; le comportement ne change que sur décision produit.
  Une idée tranchée **monte** en fiche domaine ou est supprimée avec verdict
  noté. Une ⚠️ Position tranchée devient du comportement décidé (ou disparaît).

## Critères de succès

- Un nouveau chantier produit peut se cadrer en lisant la fiche concernée,
  sans archéologie dans les audits ni la mémoire de session.
- Zéro contradiction avec `system-design.md` (frontières produit/technique
  respectées de part et d'autre).
- Toutes les remises en question et idées portent un verdict explicite à
  prendre — aucune décision implicite glissée dans le descriptif.

## Exécution (résumé pour le plan)

1. Extraction du comportement réel depuis le code (prompts, quotas, services)
   — par domaine, vérifiée, pas de mémoire.
2. Recherche concurrentielle fraîche pour la section idées + les ⚠️ Positions
   (dont web billing : options RevenueCat Web Billing / Stripe, doc-first).
3. Rédaction du doc complet selon la structure ci-dessus.
4. Revue adversariale : cohérence interne + zéro contradiction avec
   system-design + chaque affirmation « livré » tracée vers le code.
5. Câblage : références croisées depuis `system-design.md` et `CLAUDE.md`.
