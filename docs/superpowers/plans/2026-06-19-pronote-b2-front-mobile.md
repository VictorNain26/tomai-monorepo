# Pronote B2-front — Mobile : device-first → consommation API serveur

Conception : `docs/superpowers/specs/2026-06-15-pronote-server-side-design.md`. Backend mergé : PR #248 (`062c518`). Branche : `feat/pronote-mobile-onboarding`. App : `apps/mobile` (Expo/RN, NativeWind, jest-expo).

## Objectif

Le mobile cesse de parler à Pronote en direct (pawnote dans le bundle = GPL + jeton sur device) et **consomme l'API serveur** (`getTreaty().api.pronote.*`). Le jeton vit côté serveur, l'IA l'exploite. Audit 2026-06-18 : app saine 8,5/10, **interface de `usePronote` étanche → 0 écran cassé**.

## Invariants (vérifiés à la cartographie 2026-06-19)

- **`usePronote(userId)` — interface PUBLIQUE à PRÉSERVER** : state `{isConnected, resources, resourceMappings, homework, grades, timetable, errors}` + computed `{upcomingHomework, averageGrade}` + actions `{connect(qrData,pin), disconnect, fetchHomework, fetchGrades, fetchTimetable, setResourceMapping}`. Les **13 écrans** consommateurs ne changent pas si cette surface est conservée.
- **Store `pronote-store.ts` (Zustand+MMKV) INCHANGÉ** : la source des données change (API au lieu de pawnote), pas le store.
- **Client Eden prêt** : `getTreaty()` + `unwrap()` (`packages/api/src/client.ts`), modèle `useLearning.ts` (`useQuery` + `getTreaty().api.x.get()`). Routes pronote typées et exposées (build:types serveur OK).
- **Capture QR réutilisable** : `parseQrCode()` (`lib/pronote-helpers.ts:189`) + `PronoteQrScanner.tsx` (expo-camera) — le scan reste, seul l'aval change (POST serveur au lieu de `loginQrCode` local).

## Contrats serveur réels (à utiliser verbatim — source = code mergé, PAS l'approximation d'un agent)

Confirmer contre `apps/server/src/routes/pronote-connect.routes.ts` et `pronote-data.routes.ts` :
- `GET /api/pronote/children/:childId/{grades,homework,timetable}` → `{success, data: Normalized*[]}`
- `POST /api/pronote/connect/qr` body `{qr:{jeton,login,url}, pin}` → `{success, data:{credentialId, resources}}`
- `GET /api/pronote/establishments?lat&lng` → `{success, data}`
- `GET /api/pronote/credentials/:id/children` → `{success, data: DiscoveredChild[]}`
- `POST /api/pronote/credentials/:id/activate` body `{selections:[{resourceId,firstName,lastName,schoolLevel,username,password,linkToChildId?}]}` → `{success, data:{activated, failed}}`
- `POST /api/pronote/credentials/:id/resync` → `{success, data:{added, stillMapped}}`

---

## Préambule backend — combler le gap d'affichage des notes

**Gap réel** : `NormalizedGrade` serveur = `{subject, value, scale, date, comment}`, mais les écrans mobiles affichent aussi **coefficient, moyenne de classe, min, max**.

- **Task P1** : vérifier ce que `gradesOverview` (pawnote 1.6.2) expose réellement (coefficient/average/min/max). Si présents, **enrichir `NormalizedGrade`** (`provider.types.ts`) + le mapping de `pawnoteServerAdapter.getGrades` (confirmer les champs contre les types installés). Sinon, documenter la perte côté client et ne pas inventer. Tests adapter. *(Backend ; inclus dans cette branche car intrinsèquement lié à l'affichage mobile.)*

---

## Phase A — Couche données (technique, 0 décision UX)

- **Task A1** : réécrire **`usePronote.ts`** pour consommer l'API. Remplacer `pronoteSessionService.refreshSession` + pawnote (`assignmentsFromIntervals`/`gradesOverview`/`timetableFromIntervals`) par `getTreaty().api.pronote.children({childId}).{homework,grades,timetable}.get(...)` (résoudre `childId` depuis `resourceMappings`). **Conserver la surface publique exacte.** Mapper `Normalized*` (serveur) → `Pronote*` (client) — helper de conversion pur et testé. Réutiliser le pattern `useLearning` (React Query, TTLs existants 15/60/30 min).
- **Task A2** : réécrire **`pronote-session.ts`** + les hooks `usePronoteOnboarding`/`usePronoteReconnect` : `connect(qrData, pin)` appelle `POST /api/pronote/connect/qr` (plus de `loginQrCode`/SecureStore local). `disconnect` → `DELETE /credentials` (ou logout). Supprimer la dépendance pawnote.
- **Task A3** : **retirer `pawnote` du `apps/mobile/package.json`** (GPL hors bundle) ; supprimer tout import résiduel ; `pnpm typecheck` + build Expo vert.
- **Task A4** : tests jest-expo (`__tests__/hooks/usePronote.test.ts` etc. existants → adapter aux mocks `getTreaty`) + le helper de conversion de types. `pnpm typecheck && pnpm lint && pnpm test`.

**Sortie A** : les 13 écrans de consultation affichent les données Pronote **via le serveur**, pawnote hors bundle, interface inchangée.

---

## Phase B — Onboarding (écrans ; décisions UX à cadrer avec Victor AVANT)

Écrans : recherche établissement (géoloc `GET /establishments`) → scan QR (existant) → `POST /connect/qr` → sélection des enfants découverts (`GET /credentials/:id/children`) → **activation avec définition du login enfant** (`POST /activate`, le parent saisit username+mot de passe par enfant) → resync (`POST /resync`).

**Décisions UX à trancher (NE PAS coder avant)** :
1. Parcours d'onboarding (ordre, écran unique vs wizard ; géoloc auto vs recherche manuelle).
2. Écran « définir l'accès de l'enfant » (où/comment le parent saisit username+mot de passe ; validation ; force du mot de passe).
3. Sort de l'espace élève existant (`(student)/*`) et de `child-access-store` (PIN) : garder/adapter/retirer (cf. audit : 23 % réutilisable, 36 % à adapter, 41 % à jeter).
4. Détection de doublon (`existingChildId`) : UX du « lier vs créer ».

Designer lead (tokens, a11y, états complets, mobile-first) s'applique sur cette phase.

---

## Hors scope / risques

- **WebView ENT** (fast-follow UX pour parents sans l'app Pronote) — différé.
- **Token rotatif réel** : se valide au front quand un vrai jeton circule (le QR capturé arrive au serveur).
- Migration `resourceMappings` : aujourd'hui le store mappe `childId → resourceIndex` local ; côté serveur le mapping est en DB (`pronote_child_resources`). Vérifier la cohérence (le mapping fait foi côté serveur ; le store local devient un cache d'affichage).

## Exécution

Subagent-driven (comme B2-backend). Phase A enchaînable immédiatement (technique). Phase B après cadrage UX. PR `feat/pronote-mobile-onboarding` → main une fois A+B verts.
