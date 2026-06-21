# Onboarding Pronote serveur (QR-first complet) — Design

**Date** : 2026-06-21
**Statut** : design validé en brainstorming, à transformer en plan d'implémentation.
**Périmètre** : `apps/server` (2 ajouts d'API) + `apps/mobile` (wizard + gestion + nettoyage). Branche : `feat/pronote-onboarding-server`.
**Pré-requis livrés** : sous-projet 1 (login enfant autonome, `#250`) + Phase A données (`#249`), tous deux mergés sur `main`.

C'est le **sous-projet 2** du chantier Pronote B2-front. Le **sous-projet 3** (WebView ENT pour les parents sans l'app Pronote + recherche d'établissement géoloc) est un problème technique distinct (auth WebView multi-fournisseurs ENT, hors pawnote) traité séparément après celui-ci.

**Pas de demi-version.** Tous les flux réels sont dans le périmètre : découverte multi-enfant, activation avec création OU lien (auto et manuel), échecs partiels d'activation avec reprise, jeton QR expiré, resync, multi-établissement, reset du mot de passe enfant.

---

## Problème

Le mobile ne sait pas encore faire l'onboarding Pronote contre le serveur. La chaîne serveur existe (`connect/qr` → `discover` → `activate` → `resync`) mais côté mobile : l'ancien onboarding local a été supprimé (sous-projet 1), `usePronote.connect()` est devenu du code mort, et le badge « Pronote connecté » lit un mapping **local** (`pronote-store.resourceMappings`, MMKV) désaligné de la vérité serveur (`pronote_child_resources`). Un enfant peut désormais avoir un vrai compte autonome ; l'onboarding Pronote doit le provisionner (login défini par le parent) ou le **lier** à un enfant existant.

## Objectif

1. Le parent connecte un (ou plusieurs) compte(s) Pronote par **scan QR**, le serveur découvre les enfants, le parent les **active** (crée le login autonome) ou les **lie** à un enfant TomAI existant.
2. Le mobile cesse de s'appuyer sur le mapping local : la vérité du mapping vit côté serveur.
3. Gestion complète : multi-établissement, resync, reprise d'échecs, reset mot de passe enfant.

---

## Architecture

### Vue d'ensemble des unités

| Unité | Responsabilité | Dépend de |
|-------|----------------|-----------|
| `usePronoteConnect` (nouveau hook) | Machine d'état serveur-driven du wizard : scan→pin→connect/qr→discover→activate, reprise des échecs | `getTreaty().api.pronote.*`, `pronote-helpers` |
| Écran wizard `pronote-connect.tsx` | Orchestration des étapes (composants `PronoteStep*` réutilisés) | `usePronoteConnect` |
| `ChildCredentialsFields` (composant extrait) | Groupe de champs login enfant (username/password/level) partagé wizard ↔ add-child | primitives `@/components/ui/` |
| Écran gestion `pronote-manage.tsx` | Liste les établissements connectés, resync, « connecter un autre », reset mdp enfant | `getTreaty().api.pronote.credentials.list`, hook gestion |
| `usePronote` (simplifié) | **Lecture seule** : grades/homework/timetable par `childId` | endpoints data |
| Badge dashboard | `hasPronote` lu depuis la **liste enfants serveur** | `GET /parent/children` |

### Flux du wizard (par établissement)

```
Intro → Scan QR → PIN Pronote
  → POST /api/pronote/connect/qr            → { credentialId, resources }
  → GET  /api/pronote/credentials/:id/children   (discover) → DiscoveredChild[]
  → Sélection des enfants à importer (PronoteChildImport, dédup sur enfants déjà liés)
  → Pour chaque enfant sélectionné : « définir l'accès »
       • match serveur (existingChildId ≠ null) → carte « sera relié à <prénom> », confirmation
       • OU lien manuel : le parent choisit un enfant TomAI existant à lier
       • sinon création : username (pré-rempli depuis le nom) + mot de passe (min 8 + robustesse) + niveau (suggéré)
  → POST /api/pronote/credentials/:id/activate  { selections[] } → { activated[], failed[] }
  → Récap : logins créés à transmettre + échecs éventuels (voir reprise ci-dessous)
```

### Contrats serveur consommés (existants)

- `POST /api/pronote/connect/qr` — body `{ qr: { jeton, login, url }, pin: string(4) }` → `{ credentialId: uuid, resources: DiscoveredResource[] }`
- `GET /api/pronote/credentials/:id/children` → `DiscoveredChild[]` = `DiscoveredResource & { suggested: { firstName, lastName, schoolLevel|null }, existingChildId: string|null }`
- `POST /api/pronote/credentials/:id/activate` — body `{ selections: ActivationSelection[] }` → `{ activated: { resourceId, childId }[], failed: { resourceId, reason }[] }`
  - `ActivationSelection = { resourceId, firstName, lastName, schoolLevel, username(min3, /^[a-zA-Z0-9_.]+$/), password(min8), linkToChildId? }`
- `POST /api/pronote/credentials/:id/resync` → `{ added: DiscoveredChild[], stillMapped: number[] }`
- `PATCH /parent/children/:id` — body `{ password? , firstName?, ... }` (reset mot de passe enfant, existant)
- data : `GET /api/pronote/children/:childId/{grades,homework,timetable}` (inchangés)

### Ajouts serveur (2)

1. **`GET /api/pronote/credentials/list`** → `{ success, data: PronoteCredentialSummary[] }` avec `PronoteCredentialSummary = { credentialId: uuid, establishmentName: string, establishmentUrl: string, childCount: number }`. Route fine → `pronoteSyncService.listCredentials(userId)` (le `getCredentials` actuel ne renvoie qu'un enregistrement). Garde d'ownership identique aux autres routes credentials.
2. **`hasPronote: boolean` sur `GET /parent/children`** : `ChildInfo` gagne le champ, dérivé d'une jointure `pronote_child_resources` (un enfant a `hasPronote=true` s'il a au moins un mapping). `parentService.getParentChildren` joint la table ; le type Eden `ChildInfo` est étendu (champ requis, pas optionnel, pour rester nommable côté `@repo/api`).

---

## Réconciliation du mapping (suppression du local)

Le mapping `childId ↔ ressource Pronote` vit **uniquement** côté serveur (`pronote_child_resources`). Côté mobile :

- **Supprimer** `resourceMappings`, `setResourceMapping`, `resources`, `isConnected`, `metadata`, `connect()` de `usePronote` + `pronote-store` (tout le reliquat de l'ancien modèle device-first/local). `connect()` est déjà du code mort (son seul appelant, l'ancien onboarding, a été supprimé en sous-projet 1).
- `usePronote` se réduit à la **lecture** : `grades`/`homework`/`timetable` + `fetchGrades/Homework/Timetable(childId)` (le serveur résout le mapping via `assertParentOrSelf` + `pronote_child_resources`) + cache TTL + erreurs.
- Le **badge** dashboard lit `child.hasPronote` (liste enfants serveur), plus `resourceMappings`.

---

## Composants

- **Réutilisés tels quels** : `PronoteStepIntro`, `PronoteStepQrScan`, `PronoteStepPin`, `PronoteQrScanner`, `PronotePinEntry`, `PronoteChildImport`, `PronoteStepConnecting`, `PronoteStepSuccess`, `PronoteBadge`, et `pronote-helpers` (`parseQrCode`, `extractEstablishment`, `splitPronoteName`, `pronoteUsername`, `toPronoteDedupeKey`).
- **Retravaillé** : l'étape « PIN enfant » devient **« définir l'accès enfant »** — rend `ChildCredentialsFields` (username/password/level) en mode création, ou une carte de confirmation en mode lien (existant ou manuel). `ChildPinData` (type) → remplacé par un type `ChildAccessSelection` aligné sur `ActivationSelection`.
- **Extrait** : `ChildCredentialsFields` (username + mot de passe avec robustesse + niveau) sorti de `add-child.tsx` et réutilisé par les deux écrans (DRY). `add-child` garde en plus prénom/nom/date de naissance ; le wizard pré-remplit prénom/nom depuis `suggested` et n'a pas de date de naissance (`activate` ne la prend pas).
- **Supprimé** : `PronoteStepParentPin` (plus de PIN parent dans le modèle autonome).

---

## Gestion d'erreurs (exhaustive — pas de happy-path only)

- **PIN Pronote / connect/qr** : PIN à 4 chiffres invalide → message ciblé ; **jeton QR expiré** (durée de vie ~10 min, `BadCredentials`/reauth côté serveur) → message « QR expiré, régénérez-le dans Pronote et rescannez » + retour à l'étape scan ; réseau/timeout → retry.
- **discover** : 0 enfant découvert → message clair (compte connecté mais aucun enfant) ; réseau/timeout → retry sans reperdre le credential.
- **activate partiel** : `failed[]` non vide → l'écran récap affiche, **par enfant en échec, la raison** (ex. `username` déjà pris) et permet de **corriger** (éditer l'username) puis **ré-activer uniquement le sous-ensemble échoué** (nouvel appel `activate` avec les sélections corrigées). Les `activated[]` ne sont pas rejoués (idempotence côté UX).
- **resync** : idempotent ; affiche les `added` ; `stillMapped` informatif. Si 0 ajout → message « à jour ».
- **multi-établissement** : chaque credential est indépendant ; un échec sur l'un n'affecte pas les autres ; l'écran de gestion isole les erreurs par carte.
- **reset mot de passe enfant** : validation min 8 + robustesse ; succès → confirmation que le nouveau mot de passe doit être retransmis à l'enfant.

---

## Entrées & navigation

- **Dashboard parent** : empty-state (0 enfant) → CTA « Ajouter un enfant » (manuel) **et** « Connecter Pronote » (wizard). Avec enfants : entrée « Connecter Pronote » / « Gérer Pronote ».
- **Profil parent** : section « Pronote » → écran `pronote-manage` :
  - 0 credential → lance directement le wizard `pronote-connect`.
  - ≥1 credential → liste les établissements (nom, nombre d'enfants), chacun avec **resync** ; bouton **« Connecter un autre établissement »** (relance le wizard) ; accès au **reset mot de passe** par enfant (réutilise `PATCH /parent/children/:id`).
- Routes typées enregistrées dans `(parent)/_layout.tsx` : `pronote-connect`, `pronote-manage`.

---

## Tests

- **Serveur** (`bun run test` + `test:integration`) :
  - `GET /credentials/list` : 0 / 1 / N credentials ; ownership (un parent ne voit que ses credentials) ; `childCount` correct.
  - `hasPronote` sur `getParentChildren` : enfant mappé → `true`, non mappé → `false` ; ne fuit pas entre parents.
  - Non-régression `discover`/`activate`/`resync` (gardes IDOR/ownership, compensation orphelin) et `assertParentOrSelf`.
  - Piège mock `api-endpoints.test.ts` si un nouveau module tire les schémas Drizzle (cf. `.claude/rules/testing-and-commits.md`).
- **Mobile** (`pnpm test`) :
  - `usePronoteConnect` : happy path connect→discover→activate ; **activate partiel** (un `failed`, correction username, ré-activation du sous-ensemble) ; **lien** (existingChildId) ; **lien manuel** (choix d'un enfant existant) ; **resync** ; jeton expiré → retour scan.
  - Wizard `pronote-connect` : rendu des étapes, transitions.
  - `pronote-manage` : liste credentials, resync, reset mdp.
  - `ChildCredentialsFields` : validation partagée (username pattern, mot de passe min 8 + robustesse).
  - Badge dashboard lit `hasPronote` serveur (plus de `resourceMappings`).
  - `usePronote` simplifié : plus de `resourceMappings`/`connect` (tests obsolètes retirés).
- Validation avant commit : serveur `typecheck && lint && test (+ integration)` ; mobile `typecheck && lint && test`.

---

## Hors périmètre (sous-projet 3, distinct)

- **WebView ENT** : onboarding pour les parents sans l'app Pronote (établissements ENT-gated) — auth WebView multi-fournisseurs ENT, recherche doc-first dédiée, hors pawnote.
- **Recherche d'établissement géoloc** (`GET /establishments`) : ne sert qu'au parcours sans-QR (ENT) → part avec le sous-projet 3.
- Route device-first `PUT /api/pronote/credentials` (ancien modèle de sync token depuis l'appareil) : laissée en place, non utilisée par cet onboarding, non supprimée ici.

## Risques / points d'attention

- **Frontière de types Eden** : `ChildInfo.hasPronote` et `PronoteCredentialSummary` doivent être **exportés/nommables** pour `build:types` (cf. `apps/server/CLAUDE.md` — un type qui fuit dans `App` non nommable casse l'émission du `.d.ts`).
- **Suppression de `resourceMappings`** : vérifier qu'aucun écran (student inclus) ne le lit avant retrait ; le badge bascule sur `hasPronote` dans le même incrément pour rester vert.
- **Taille** : le plan séquencera en incréments testables — (1) ajouts serveur (`credentials/list` + `hasPronote`), (2) `usePronoteConnect` + wizard, (3) écran gestion + resync + reset mdp, (4) bascule badge serveur + nettoyage `usePronote`/`pronote-store`.
