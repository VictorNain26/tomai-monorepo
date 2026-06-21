# Login enfant autonome — suppression de l'impersonation

**Date** : 2026-06-21
**Statut** : design validé en brainstorming, à transformer en plan d'implémentation.
**Périmètre** : `apps/server` (Better Auth) + `apps/mobile` (auth + routing) + `packages/api` (client Better Auth).
**Pré-requis** : aucun. **Pas de prod / pas d'utilisateurs réels** → aucune migration de données, conception sans rétro-compat.

C'est le **sous-projet 1** d'un découpage en deux. Le **sous-projet 2** (refonte de l'onboarding Pronote : scan QR → `discover` → `activate` → `resync`) se construit *par-dessus* ce modèle d'auth et fait l'objet de son propre spec.

---

## Problème

Aujourd'hui un compte enfant **n'a aucun accès autonome**. Le seul chemin vers l'espace `(student)` est l'**impersonation** Better Auth Admin : le parent se connecte, choisit un profil enfant dans `profile-select` (gardé par un PIN local stocké en MMKV via `child-access-store`), et l'app appelle `admin.impersonateUser`. Le parent « devient » l'enfant.

Décision produit (Victor, 20-21/06) : **plus d'impersonation**. L'enfant a un **vrai compte** et se connecte **lui-même** (identifiant + mot de passe, sur son propre appareil). Le parent ne devient jamais l'enfant ; il **supervise** via son dashboard parent.

## Objectif

1. Un enfant se connecte en autonomie avec **identifiant + mot de passe** (login défini par le parent).
2. Le parent crée/gère ses enfants **sans dépendre de Pronote** (création découplée).
3. Toute la machinerie d'impersonation (profile-select, PIN local, `launchChildSession`/`restoreParentSession`, bannière « Return to Parent », plugin admin) est **retirée**.
4. Le dashboard parent et l'espace `(student)` continuent de fonctionner à l'identique.

---

## Modèle cible

| Acteur | Connexion | Accès |
|--------|-----------|-------|
| Parent | email + Google (inchangé) | `(parent)/tabs` direct ; lit les données de ses enfants via endpoints parent-scopés |
| Enfant | **identifiant + mot de passe** (`signIn.username`) | `(student)` direct (sa propre session Better Auth) |

Le routing `RootNavigator` route déjà par `user.role` (`apps/mobile/src/app/_layout.tsx`) : une session enfant ouvre `(student)`, une session parent ouvre `(parent)`. Plus de `profile-select` intermédiaire.

**Accès aux données enfant côté parent — déjà en place, aucune impersonation requise** : les endpoints `GET /api/pronote/children/:childId/{grades,homework,timetable}` autorisent via `assertParentOrSelf` (`apps/server/src/routes/pronote-data.routes.ts:36`) — `userId === childId` **OU** `isParentOf(userId, childId)`. Le parent en session parent passe `childId` et reçoit 200 (testé `pronote-data-routes.test.ts:159-183`). Retirer l'impersonation ne change rien ici.

---

## Changements — Backend (`apps/server`)

### 1. Plugin `username` Better Auth

Source doc-first : [better-auth.com/docs/plugins/username](https://www.better-auth.com/docs/plugins/username) (`docs/plugins/username.mdx`) — *« adds username support to the email and password authenticator … sign in with their username instead of their email »*.

- Ajouter `username()` aux plugins serveur (`apps/server/src/lib/auth.ts`), au-dessus de l'`emailAndPassword` déjà actif.
- Exposera `POST /api/auth/sign-in/username` (`signIn.username({ username, password })`).
- **À vérifier en implémentation (point dur)** : le projet déclare aujourd'hui `username` / `displayUsername` en **`additionalFields`** (`auth.ts:189-192`). Le plugin `username` gère ces colonnes nativement → risque de double-déclaration / collision de schéma. Vérifier la doc du plugin + le schéma Drizzle (`auth.schema.ts`) et **retirer les additionalFields redondants** si le plugin les couvre. Mesurer via `bun run typecheck` + un test d'auth.
- **Alignement validation** : le plugin normalise/valide l'identifiant (longueur, casse). Le username défini par le parent (min 3, cf. sous-projet 2) doit satisfaire ces règles. Documenter les contraintes effectives du plugin et les refléter dans la validation du formulaire.
- L'email interne auto-généré `child_*@internal.tomai` (`parent.service.ts:103`) reste interne : l'enfant se connecte par identifiant, jamais par email.

### 2. Suppression de l'impersonation

- Retirer le plugin `admin()` et son hook `impersonationAllowed` (`auth.ts:210-286`).
- Supprimer `src/lib/impersonation-policy.ts` (`canParentImpersonate`) et son test.
- YAGNI : aucun autre usage que parent→enfant aujourd'hui. Si le support a un jour besoin d'impersonation admin, ré-ajout ciblé à ce moment-là.

### 3. Création d'enfant (déjà générique — à confirmer, pas à refaire)

`POST /api/parent/children` (`parent.service.ts:createChild`) crée déjà un compte enfant via `signUpEmail` (credential password hashée en table `account`), `role: 'student'`, lien parent-enfant. Il prend `username` + `password`. **Aucun nouvel endpoint requis pour le sous-projet 1.** Un endpoint de **reset de mot de passe enfant** par le parent sera spécifié dans le sous-projet 2 (besoin onboarding + resets), pas ici.

---

## Changements — Mobile (`apps/mobile`) + client (`packages/api`)

### 4. Client Better Auth

- Ajouter `usernameClient()` au client (`packages/api` / `apps/mobile/src/lib/auth.ts`), aligné avec le plugin serveur.
- Retirer du client tout ce qui touche `admin` (`impersonateUser`/`stopImpersonating`).

### 5. Écran de connexion — toggle Parent / Élève

- Un **écran de login unique** avec segmented control **« Parent / Élève »**.
  - **Parent** : email + Google (existant, inchangé).
  - **Élève** : identifiant + mot de passe → `signIn.username`.
- Designer lead : états complets (idle / submitting / erreur identifiants invalides), a11y (labels, rôles, cibles ≥44pt, contrast), mobile-first, tokens `@repo/tokens`. Pas de `StyleSheet` si NativeWind suffit ; primitives `@/components/ui/`.

### 6. Suppressions (machinerie d'impersonation)

| Élément | Fichier(s) |
|--------|-----------|
| Écran de sélection de profil | `src/app/(parent)/profile-select.tsx` + route dans `(parent)/_layout.tsx` |
| Store PIN local | `src/stores/child-access-store.ts` (+ son test) |
| Helpers session impersonée | `launchChildSession`, `restoreParentSession`, `useImpersonatedBy` (`src/lib/auth.ts`) |
| Bannière « Return to Parent » | `src/app/(student)/_layout.tsx` |
| CTA « Lancer Tom pour [enfant] » | `src/app/(parent)/tabs/(home)/child/[id]/index.tsx:98` **et** `src/components/parent/ChildSummaryCard.tsx:122` (les deux appellent `launchChildSession`) |

### 7. Nouvel empty-state parent : « Ajouter un enfant » (manuel, découplé de Pronote)

Retirer `child-access-store` casse l'onboarding Pronote actuel (`usePronoteOnboarding`/`usePronoteReconnect` appellent `setCredential`/`setParentCredential`). On remplace donc l'empty-state actuel (parent à 0 enfant → onboarding Pronote) par un **écran d'ajout d'enfant manuel** :

- Formulaire : prénom, nom, niveau scolaire, **identifiant**, **mot de passe** (min 8, indicateur de robustesse).
- Appelle `POST /api/parent/children` (générique, déjà existant).
- Après création : l'enfant peut se connecter en autonomie. Le parent retrouve l'enfant dans son dashboard.
- C'est la **base** ; Pronote (sous-projet 2) deviendra un enrichissement optionnel qui crée-ou-lie des enfants.

### 8. Onboarding Pronote actuel — différé (pas supprimé définitivement)

- **Retirer** l'entrée Pronote QR et les hooks `usePronoteOnboarding` / `usePronoteReconnect` + leurs écrans (`onboarding-pronote.tsx`, `pronote-connect.tsx`) — ils portent l'ancien modèle local. Pré-prod : retrait franc, pas de masquage. Le sous-projet 2 les réécrit.
- **Conserver les composants réutilisables** pour le sous-projet 2 : `PronoteQrScanner`, `PronoteStep*`, `parseQrCode` (`lib/pronote-helpers`).
- **Laisser `pronote-store` en place** (le badge « Pronote connecté » du dashboard via `resourceMappings`). Sa migration vers le mapping serveur est un sujet du sous-projet 2, hors de ce spec.

---

## Ce qui ne bouge pas

- Tout l'espace `(student)` : chat, learning, écrans Pronote enfant (`usePronote(user.id)` sur la session enfant).
- Le dashboard parent et ses écrans data enfant (déjà parent-scopés).
- `pronote-store` (touché en sous-projet 2).

---

## Tests

- **Serveur** (`bun run test` + `test:integration`) : login enfant par identifiant (succès + mauvais mot de passe + identifiant inconnu) ; un compte enfant créé via `createChild` est connectable par `signIn.username` ; non-régression `assertParentOrSelf` (parent lit data enfant, tiers refusé). Piège mock `api-endpoints.test.ts` si un nouveau module tire les schémas Drizzle (cf. `testing-and-commits.md`).
- **Mobile** (`pnpm test`) : toggle login (rend les deux formulaires), soumission élève appelle `signIn.username`, formulaire ajout d'enfant appelle `POST /api/parent/children`. Suppression des tests `child-access-store` / `profile-select`.
- Validation obligatoire avant commit : serveur `typecheck && lint && test (+ integration)` ; mobile `typecheck && lint && test`.

## Hors scope

- **Sous-projet 2** : refonte onboarding Pronote (scan → `discover` → `activate` → `resync`), endpoint reset mot de passe enfant, migration `resourceMappings` → serveur.
- Migration de comptes existants : **sans objet** (pas de prod).
- Récupération de mot de passe enfant oublié en self-service (l'enfant n'a pas d'email réel) : le parent reset (spécifié en sous-projet 2). À documenter comme limite connue.

## Risques

- **Plugin `username` vs `additionalFields` existants** : principal point dur — collision de schéma possible. À cadrer en premier dans le plan, prouver par typecheck + test d'auth avant d'aller plus loin.
- **Retrait du plugin `admin`** : vérifier qu'aucun autre appel client/serveur n'en dépend (grep `admin.` exhaustif) avant suppression.
