# Audit Tom — Backend & Produit/Marché

> **STATUT (2026-07-07)** : tous les P0 livrés (#237, #245, #246). **Roadmap
> superseded** par l'audit 2026-07-01 (`2026-07-01-curriculum-to-frontend-architecture.md`).
> Les findings non traités restent valables comme matière.

**Date** : 2026-06-14
**Périmètre** : backend `apps/server` (~32k LOC) + revue produit/marché complète
**Méthode** : 8 agents d'audit parallèles (read-only) + recherche concurrentielle web
**Posture** : tech lead + marketing lead

---

## 0. Décisions (2026-06-14)

- **Mode consolidation, pas de date de lancement.** On résorbe la dette dans l'ordre P0→P1→P2 et on muscle le produit avant de l'exposer publiquement. Les « P0 » ci-dessous restent la priorité, non plus comme *gate de lancement* mais comme *dette à enjeu fort* à traiter en premier.
- **Landing : révision reportée à la fin.** On ne retire ni n'ajuste les promesses non livrées (limites de temps, résumés d'activité, établissement) maintenant — on revoit la landing une fois le produit consolidé.
- **Pronote : trajectoire non tranchée.** Device-first (pawnote) vs partenariat Index Education à creuser séparément, avec les risques ToS/technique détaillés, avant décision.
- **Chantiers P0 regroupés en 3 lots (3 PR indépendantes) :**
  1. **Coûts IA** — cost-tracking (clés pricing) + `subject` dans `promptCacheKey` + `max_tokens` fallback. *Premier chantier : trivial, débloque la visibilité coût qui éclaire le modèle éco.*
  2. **Sécu/billing** — authz `children_ids` + rate-limit Pronote (`ctx.user`) + webhook hors rate-limit global.
  3. **RGPD/intégrité** — purge `chat_messages` + credentials expirés + pseudonymisation art.17 + CASCADE `session_episodes`→SET NULL + CHECK `billing_status`.

---

## 1. Résumé exécutif

Tom est un **MVP mobile en soft-launch** (landing en liste d'attente, pas encore sur les stores). Le backend est **sain dans ses fondations** (archi en couches respectée, crypto Pronote exemplaire, idempotence webhook atomique), mais porte **trois zones rouges qui bloquent un lancement public** : la maîtrise des **coûts IA** (le poste qui *est* le modèle économique), trois failles de **sécurité/billing** réelles, et une **conformité RGPD partielle** pour un produit qui traite des données de mineurs.

Côté marché, le positionnement est **juste et défendable** : l'angle anti-offloading ("ChatGPT fait les devoirs à sa place ; Tom lui apprend à les faire") est documenté et adresse une peur réelle de 71 % des parents. Trois white spaces concurrentiels confirmés (Pronote, FSRS+socratique couplés, suivi parental actionnable). Le risque principal n'est pas le positionnement — c'est l'**écart entre les promesses de la landing et ce qui est réellement livré**, et la **dépendance non maîtrisée au coût Mistral** derrière la promesse "questions illimitées".

### Scorecard technique

| Dimension | Note | Verdict |
|---|---|---|
| Architecture & frontières | 7,5/10 | Couches respectées, Mistral centralisé. 2 frontières fuient (file-upload, 3 services en DB directe) |
| Sécurité | 7,5/10 | Fondations solides, mais 3 P0 réels (rate-limit Pronote inopérant, authz billing, webhook sous rate-limit) |
| Qualité & dette | 6,5/10 | Cohérent, mais duplication (niveaux scolaires ×5) et 186 casts symptôme d'un type trop lâche |
| Tests | 7,0/10 | 406 tests verts, chemins billing/quota/crypto bien couverts. Trou béant : RAG service zéro test |
| Perf & coûts IA | 5,5/10 | **Point le plus bas.** Cost-tracking cassé, cache prompt qui rate, N+1, max_tokens fallback à 16k |
| Données & migrations | 7,0/10 | Schéma propre, mais CASCADE qui détruit la mémoire long-terme + `billing_status` sans contrainte |

**Moyenne technique : ~6,8/10** — un backend correct, pas en danger structurel, mais avec des P0 ciblés à fort enjeu business.

---

## 2. Partie A — Audit technique

### 2.1 Sécurité (7,5/10)

**P0 — à corriger avant lancement public :**

1. **Rate-limit Pronote inopérant** — `middleware/rate-limit.middleware.ts:230-235` lit `ctx.student?.id` qui n'existe nulle part (le macro injecte `ctx.user`). La surface la plus sensible (credentials élèves + PBKDF2 600k itérations, coûteux) retombe sur l'IP partagée du proxy Koyeb → protection per-user inexistante. **Fix : une ligne** (`ctx.user?.id`).
2. **Élévation de privilège billing** — `routes/revenuecat-webhook-events.ts:84,115,149` : `parseChildrenIds` vient des `subscriber_attributes` fixés côté mobile. Un parent premium peut envoyer des `children_ids` arbitraires et activer le premium sur des comptes enfants tiers (aucune vérif du lien parent→enfant côté serveur). **Fraude + fuite d'accès.**
3. **Webhook RevenueCat sous le rate-limit global** — `app.ts:96` vs `:278` : le webhook est monté après `onBeforeHandle(RateLimitPresets.api)` (100 req/min/IP). Un burst de renouvellements/retries peut dropper des events de facturation en 429 → désync abonnements/revenus.

**Moyennes :** purge RGPD partielle (cf. §2.6), rate-limit `ai` scopé IP au lieu de user (dépend de l'ordre Elysia, à confirmer runtime), store rate-limit in-memory mono-instance (contournable si >1 réplica Koyeb).

**Solide :** crypto Pronote (AES-256-GCM, IV/salt random, tamper→throw), IDOR scopé sur les routes, anti-prompt-injection sérieux.

### 2.2 Architecture (7,5/10)

Pattern routes→services→repos respecté dans l'ensemble, Mistral centralisé via `mistral-client.ts`, `learning.service` érige le bon pattern en référence.

**3 dettes principales :**
1. `routes/file-upload.routes.ts:74-296` — seule route qui orchestre du métier (Gladia, storage, statuts) + 9 appels repo directs. Source des checks IDOR dupliqués ×4. → extraire un `FileService`.
2. 3 services en accès DB direct (`cognitive-profile.service.ts:109`, `cost-tracking.service.ts:105`, `chat/session-cleanup.ts:61`) → passer par les repos.
3. Doublon `parent.service.ts` (232) ↔ `parent/parent-dashboard.service.ts` (216) → consolider.

Gros fichiers à surveiller : `mistral-client.ts` (417), `mistral-chat.service.ts` (385).

### 2.3 Qualité & dette (6,5/10)

- **Duplication** : table des niveaux scolaires copiée ×5 alors que `lib/education-levels.ts` est la source unique. → importer.
- **186 casts `as const`** sur `severity` : symptôme de `LogContext` trop lâche (`observability.ts:31`). Un champ typé efface les 186. 
- Code mort confirmé par knip : `simpleSearch()` (alias pur), `microChunks` (toujours `[]`), facade `parent.service.ts`, ~20 types exportés non consommés. **Réserve** : ne pas supprimer les types du contrat `App`/Eden sans vérifier `build:types` (piège connu).

### 2.4 Tests (7,0/10)

406 tests, 37 fichiers, **37 pass / 0 fail**, ~15 s sans infra. Bien couverts : webhooks (signature/idempotence), quota (fail-open garanti), encryption (vrais appels crypto), transactions learning (rollback testé).

**Trous à risque :**
1. `rag.service.ts` (332 lignes) — **zéro test**. Si ai-service tombe, le fallback est-il dégradé propre ou exception qui rompt le streaming ? Cœur de la promesse "415 programmes".
2. Billing partielle sans rollback — `activatePremium` fait N inserts sans transaction ; échec inter-enfants = facturation incohérente, non testé.
3. Skip sandbox en prod — chemin jamais exercé (`isProduction` mocké à false partout).

### 2.5 Perf & coûts IA (5,5/10) — le point critique

**Estimation : ~0,011 €/session chat (10 échanges) sans cache, ~0,005 € avec.** À 15 €/mois, marge théorique large — mais on ne le *sait* pas, car :

1. **Cost-tracking cassé** — `cost-tracking.service.ts:45-48` : les clés de pricing (`mistral-medium-3`) ne matchent jamais les IDs réels (`mistral-medium-latest`) → `costCents=0` partout → **dashboard coûts entièrement aveugle.** Fix 15 min.
2. **Cache prompt qui rate** — `mistral-chat.service.ts:152-153` : `subject` exclu du `promptCacheKey` alors qu'il est dans le system prompt → cache miss à chaque changement de matière. **-40 % de coût chat raté.** Fix 5 min.
3. **`max_tokens` fallback à 16 384** — `config/env.ts:76` : tout appel sans `maxTokens` explicite peut déraper ×8-16.
4. N+1 dashboard parent, profil cognitif rechargé à chaque message, double SELECT quota par message.

### 2.6 Données & migrations (7,0/10)

**3 risques data :**
1. `session_episodes.session_id` **CASCADE** (`learning.schema.ts:256`) — une purge de session détruit la mémoire long-terme, qui est précisément faite pour survivre. → `SET NULL`.
2. `billing_status` `varchar(50)` libre, sans CHECK ni enum — un webhook mal mappé corrompt le statut sans erreur DB.
3. Pseudonymisation RGPD art.17 sur `retrieval_audit.user_id` **non vérifiée** — le commentaire la garantit, mais le job n'est pas visible.

**Index manquants :** `user_subscriptions.plan_id`, `cost_tracking.session_id`, `study_sessions.ended_at`.

---

## 3. Partie B — Revue produit & marché

### 3.1 Inventaire — l'asymétrie structurante

**100 % des features produit sont sur mobile uniquement.** Le web (`apps/web`) est une coquille de templates statiques non branchés (assumé "design template" dans son CLAUDE.md). La landing est en mode liste d'attente.

Features livrées (mobile) : chat socratique SSE, pièces jointes (image/PDF/voix), vision, STT/TTS, FSRS (decks/cards/génération IA), Pronote (QR, devoirs, notes, EDT — device-first via pawnote), dashboard parent, impersonation enfant + PIN, abonnement RevenueCat, quota tokens, push.

**Écarts à traiter :**
- **Promis non livré** (landing) : "limites de temps d'utilisation" (zéro backend), "résumés d'activité parents" (pas de push/email), espace établissement ("bientôt", zéro backend).
- **Backend-only** : `GET /progress/dashboard` (stats élève non appelées), `GET /tts/voices` (pas de sélection de voix front).

### 3.2 Carte concurrentielle (recherche web sourcée)

| Catégorie | Acteurs | Prix | Leur faille |
|---|---|---|---|
| Contenus sans tutorat | Kartable, Nomad, digiSchool, Bordas/Maxicours | 6,67–15 €/mois | Pas d'IA tuteur, reconduction tacite mal vécue |
| Tuteur IA / hybride | SchoolMouv, MyTrainia (maths only) | 9,99–19,99 €/mois | Mono-matière ou IA secondaire, pas de Pronote |
| Profs humains | Acadomia, Les Sherpas | 14–139 €/mois | 4-10× plus cher, pas de révision quotidienne |
| Mémorisation | Anki (gratuit), Quizlet | 0–10,83 €/mois | Pas de tutorat, friction onboarding |
| **Le "gratuit"** | **ChatGPT/Gemini** | **0 €** | **Donne la réponse → offloading cognitif documenté** |

**Le vrai concurrent est ChatGPT gratuit** (60-90 % des lycéens l'utilisent). L'argument n'est pas "mieux que ChatGPT sur le raisonnement" (perdu) — c'est **"ChatGPT fait les devoirs à sa place ; Tom lui apprend à les faire."** 71 % des parents craignent l'offloading (GoStudent/Opinium 2024).

### 3.3 White spaces (différenciation non-substituable)

1. **Pronote + révision sur le programme réel** — aucun acteur B2C ne le fait. Voie durable = partenariat Index Education (vs device-first actuel, fragile).
2. **FSRS + socratique couplés** — Anki a l'algo sans tutorat, MyTrainia le socratique sans flashcards. Personne ne couple. Tom : dialogue → génère les cartes FSRS → planifie les révisions.
3. **Suivi parental actionnable** — pas des graphiques, mais "quoi faire ce soir" (alertes lacunes, devoirs Pronote à venir).
4. **Multi-acteurs élève+parent+établissement** avec continuité de données — B2B2C inexploité.

### 3.4 Messaging & pricing actuels

Promesse (hero) : *"L'IA qui aide à comprendre, pas à copier."* Persona payeur = **parent** ("votre enfant"). Trust : RGPD, hébergé en France. Pricing : Gratuit (3 matières, 5 questions/j) / Complet 15 €/mois (illimité, FSRS, Pronote, dashboard parent), +5 €/enfant, comparé à "35 €/h cours particulier".

**Verdict pricing** : 15 €/mois est **bien positionné** (segment tuteur IA 9,99-19,99 €), +5 €/enfant cohérent, comparaison juste. **Le risque est "illimité" × coût IA non maîtrisé** (cf. §4).

---

## 4. Synthèse croisée tech × produit

Le jus est à l'intersection. Cinq points où une décision technique *est* une décision business :

1. **"Questions illimitées" (landing) × coûts IA aveugles (§2.5)** — On promet l'illimité sans savoir ce qu'une session coûte (cost-tracking cassé) et en ratant 40 % d'économie de cache. La marge est probablement là, mais c'est un pari à l'aveugle. **C'est LE P0 qui mêle tech et marketing.**
2. **Pronote = white space #1 × dépendance device-first fragile** — notre plus gros différenciateur est aussi notre plus gros risque de plateforme (pawnote non officiel, Index Education peut bloquer). Décision stratégique : sécuriser via partenariat ou assumer la fragilité.
3. **Promesses landing non livrées × persona payeur** — le parent achète sur "limites de temps", "résumés d'activité", "établissement". Trois promesses sans backend. Publicité honnête + risque de déception au lancement.
4. **RGPD mineurs (§2.1/2.6) × cible produit** — purge incomplète, pseudonymisation non vérifiée, CASCADE qui détruit la mémoire. Pour des données scolaires de mineurs, c'est un risque légal *avant* le public.
5. **RAG zéro test × promesse "415 programmes"** — le moteur de la value prop #4 n'a aucun filet. S'il dégrade silencieusement, la promesse se vide.

---

## 5. Matrice de priorisation

### P0 — Bloquants avant lancement public (business / légal / coût)

| Action | Type | Effort | Pourquoi P0 |
|---|---|---|---|
| Réparer cost-tracking (`costCents=0`) | Coût | 15 min | "Illimité" aveugle sinon |
| `subject` dans `promptCacheKey` | Coût | 5 min | -40 % coût chat |
| Authz `children_ids` webhook | Sécu | ~1 h | Fraude premium / accès tiers |
| Rate-limit Pronote (`ctx.user`) | Sécu | 5 min | Protection credentials élèves |
| Webhook hors rate-limit global | Sécu | ~30 min | Perte d'events billing |
| Purge RGPD chat + credentials + pseudonymisation | Légal | ~1 j | Données mineurs |
| Trancher les promesses landing non livrées | Marketing | décision | Honnêteté + légal |

### P1 — Robustesse avant montée en charge

Tests RAG service + billing rollback · N+1 dashboard parent + cache profil cognitif · `max_tokens` fallback 16k→1k · FK `session_episodes` CASCADE→SET NULL · CHECK `billing_status` · index manquants.

### P2 — Dette structurelle

`file-upload`→`FileService` · 3 services en DB directe → repos · doublon `parent.service` · code mort knip · centraliser `education-levels` · typer `LogContext.severity`.

### P3 — Décisions stratégiques produit

Pronote officiel (Index Education) vs device-first · Web app : assumer placeholder B2B ou investir · TTS/mémoire épisodique : valeur vs maintenance · Espace établissement : quand et comment.

---

## 6. Positionnement recommandé (marketing lead)

**Promesse pivot** : *"ChatGPT fait les devoirs à sa place. Tom lui apprend à les faire."* — frontale, vérifiable, adresse la peur n°1 des parents.

**3 piliers de preuve** : (1) socratique — jamais la réponse ; (2) mémoire longitudinale — suit les lacunes dans le temps (FSRS) ; (3) visibilité parentale — sortir de la boîte noire ChatGPT.

**Cible prioritaire** : le parent décideur (déjà le persona de la landing). L'élève est l'usager, pas l'acheteur.

**Pricing** : tenir 15 €/mois, mais ne lancer "illimité" qu'une fois les P0 coûts réglés et le cost-tracking opérationnel — sinon basculer "illimité (usage raisonnable)" honnête, adossé au quota tokens existant.

---

## 7. Angles morts / à vérifier en runtime

- Ordre d'exécution Elysia 1.4 `onBeforeHandle` racine vs résolution du macro auth et parsing body : conditionne la sévérité réelle des findings rate-limit `ai`/`auth`/webhook.
- Nombre de réplicas Koyeb en prod (conditionne le rate-limit in-memory).
- Better Auth (`lib/auth.ts`) : rotation session, trustedOrigins, scopes OAuth — non audités en détail.
- Validation MIME/taille réelle des uploads — non lue.
- Existence effective du job de pseudonymisation RGPD (au-delà du commentaire).
