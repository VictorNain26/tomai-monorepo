# SP4 — Sécurité & conformité — Plan

**Spec parent** : `docs/superpowers/specs/2026-04-21-mobile-audit/README.md`
**Date** : 2026-04-21

## Goal

Apporter la conformité légale (EAA WCAG 2.1 AA), l'attestation d'intégrité app (App Attest iOS / Play Integrity Android), le SSL pinning sur les endpoints critiques, le chiffrement des caches mobiles au repos, et durcir la signature webhook RevenueCat.

## Tech Stack

- `expo-app-integrity` (App Attest + Play Integrity)
- `react-native-ssl-public-key-pinning` (pinning certificats)
- `@op-engineering/op-sqlite` (SQLCipher natif)
- `expo-crypto` + wrapper AES pour persister TanStack
- Audit a11y manuel + `react-native-ama` (optionnel)

## Livrables

1. App Integrity actif sur iOS + Android, vérifié côté serveur pour les actions sensibles (checkout, changement de mot de passe enfant, credentials Pronote)
2. SSL pinning sur `/api/auth/*` et `/api/subscriptions/*`
3. Cache TanStack persister chiffré AES-256
4. SQLite offline chiffré (SQLCipher)
5. RevenueCat webhook vérifié par signature HMAC/JWT (fin du Bearer statique)
6. Rapport d'audit a11y WCAG 2.1 AA avec issues tracées

---

## Task 1 — App Integrity (iOS + Android)

### Files

- Add: `apps/mobile/package.json` — `expo-app-integrity`
- Modify: `apps/mobile/app.config.ts` — plugin config
- Create: `apps/mobile/src/lib/app-integrity.ts` — wrapper (attestation + assertion)
- Create: `apps/server/src/services/app-integrity/app-integrity.service.ts`
- Modify: routes sensibles (checkout, credentials, setUserPassword) — valider l'assertion avant exécution
- Create: `apps/server/src/tests/app-integrity.service.test.ts`

### Steps

- [ ] **Step 1 — Install** (native)
  ```bash
  cd apps/mobile && pnpm add expo-app-integrity
  ```

- [ ] **Step 2 — Plugin config** : obtenir `teamId` Apple + enable Play Integrity (Google Cloud console)

- [ ] **Step 3 — Client wrapper** : `generateAttestation(challenge)` + `generateAssertion(payload)`. Cache l'attestation côté client (valide plusieurs heures).

- [ ] **Step 4 — Server validation** : valider l'assertion avec la lib Apple App Attest + Google Play Integrity. Reject si signature invalide ou token réutilisé (anti-replay via nonce).

- [ ] **Step 5 — Guarder les routes sensibles** : middleware `requireAppIntegrity` sur `/api/subscriptions/checkout`, `/api/pronote/credentials`, `auth.api.setUserPassword`.

- [ ] **Step 6 — Tests** : mock attestations valides/invalides, replay detection, expiration.

- [ ] **Step 7 — Feature flag** `APP_INTEGRITY_ENFORCEMENT` (défaut `false` en dev, `true` en staging/prod).

- [ ] **Step 8 — Commit**
  ```
  feat(mobile,server): require App Integrity attestation on sensitive endpoints
  ```

---

## Task 2 — SSL pinning (auth + paiement)

### Files

- Add: `apps/mobile/package.json` — `react-native-ssl-public-key-pinning`
- Modify: `apps/mobile/app.config.ts` — plugin
- Modify: `apps/mobile/src/lib/api.ts` — configurer pinning sur URL matching `/api/auth` et `/api/subscriptions`

### Steps

- [ ] **Step 1 — Extraire les SPKI hashes** depuis les certificats actuels de `api.tomia.fr` et `api-staging.tomia.fr` (openssl)

- [ ] **Step 2 — Install** (native)

- [ ] **Step 3 — Config** : fournir SHA256 des 2 certificats actifs + 1 backup (rotation)

- [ ] **Step 4 — Documentation rotation cert** : créer runbook `docs/runbooks/ssl-pinning-rotation.md` — quand Vercel/Koyeb rotent le cert, rebuild mobile + OTA update requis.

- [ ] **Step 5 — Commit**
  ```
  feat(mobile): SSL pin auth and subscriptions endpoints
  ```

---

## Task 3 — Cache TanStack persister chiffré

### Files

- Create: `apps/mobile/src/lib/encrypted-storage.ts`
- Modify: `apps/mobile/src/lib/query-client.ts` — utiliser `encryptedStorage` au lieu d'`AsyncStorage` brut

### Steps

- [ ] **Step 1 — Générer clé AES** au premier boot via `expo-crypto.getRandomBytesAsync(32)`, stockée en SecureStore sous `TOMIA_CACHE_KEY`.

- [ ] **Step 2 — Wrapper `encryptedStorage`** qui implémente `{ getItem, setItem, removeItem }` comme AsyncStorage. `setItem` : `encrypt(JSON.stringify(value))`. `getItem` : `JSON.parse(decrypt(...))` avec fallback `null` si decrypt fail.

- [ ] **Step 3 — Migration** : au premier boot après update, si ancien cache non chiffré détecté, purge (pas de données à préserver en dev, acceptable).

- [ ] **Step 4 — Tests** : round-trip encrypt/decrypt, comportement sur value corrompue.

- [ ] **Step 5 — Commit**
  ```
  feat(mobile): encrypt TanStack query cache at rest with AES-256
  ```

---

## Task 4 — SQLite chiffré (SQLCipher)

### Files

- Modify: `apps/mobile/package.json` — swap `expo-sqlite` → `@op-engineering/op-sqlite`
- Modify: `apps/mobile/src/db/client.ts`
- Modify: `apps/mobile/app.config.ts` — config plugin

### Steps

- [ ] **Step 1 — Install op-sqlite** (native, requires `pnpm build:dev`)

- [ ] **Step 2 — Réécrire `getDatabase()`** : ouvrir avec `PRAGMA key = '<hex-de-SecureStore>'`

- [ ] **Step 3 — Migration** : si ancienne DB non chiffrée détectée, drop + recreate. Pas de données à préserver.

- [ ] **Step 4 — Smoke test** : login → créer conversation → logout → login autre user → vérifier que la DB sur device n'est pas lisible via ADB.

- [ ] **Step 5 — Commit**
  ```
  feat(mobile): encrypt offline SQLite cache with SQLCipher
  ```

---

## Task 5 — RevenueCat webhook signature

### Files

- Modify: `apps/server/src/routes/revenuecat-webhook.handler.ts`
- Create: `apps/server/src/lib/revenuecat/signature.ts`
- Modify: `apps/server/src/config/environment.config.ts` — renommer `REVENUECAT_WEBHOOK_AUTH` → `REVENUECAT_WEBHOOK_SIGNING_SECRET` + fail-fast si prod et manquant
- Modify: `apps/server/src/tests/revenuecat-webhook.test.ts`

### Steps

Plan détaillé dans `docs/superpowers/plans/2026-04-21-audit-remaining.md` Item 7. Bénéficie de SP5 `BillingService` (doit être fait avant ou après selon l'ordre d'exécution).

---

## Task 6 — Audit a11y WCAG 2.1 AA

### Scope

- **Screens critiques** : login, student dashboard, chat (tom), learning (révisions), parent dashboard, child edit, pronote connect
- **Contrôles** : `accessibilityLabel` présent sur tous les éléments interactifs, `accessibilityRole` correct, contrast 4.5:1 (text)/3:1 (UI), hit targets ≥44×44pt, navigation clavier, screen reader flow

### Steps

- [ ] **Step 1 — Outillage** : installer Accessibility Inspector (Xcode) + Accessibility Scanner (Android Studio)

- [ ] **Step 2 — Scan automatique** : run sur chaque screen + exporter le rapport

- [ ] **Step 3 — Tests manuels AT** : VoiceOver (iOS) + TalkBack (Android) sur device physique

- [ ] **Step 4 — Fix inline** : chaque issue trouvée → commit séparé par screen

- [ ] **Step 5 — Text scaling** : tester à 200% (iOS Dynamic Type, Android Font Scale) — les layouts doivent absorber sans overflow

- [ ] **Step 6 — Rapport final** `docs/audits/2026-04-21-a11y-wcag-2.1-aa.md`

- [ ] **Step 7 — (Optionnel) `react-native-ama`** pour checks runtime continus.

---

## Pré-requis utilisateur

1. **Apple Developer Team ID** + entitlements App Attest
2. **Google Cloud Project** avec Play Integrity API activée
3. **Certificats** api.tomia.fr + api-staging.tomia.fr — extraire SPKI SHA256
4. **Device physiques iOS + Android** pour tests VoiceOver / TalkBack

## Ordre d'exécution recommandé

1. Task 6 (a11y audit) — peut démarrer tout de suite, bloque rien
2. Task 3 (TanStack cache chiffré) — isolé, simple
3. Task 5 (RevenueCat signature) — backend only
4. Task 2 (SSL pinning) — natif, rebuild
5. Task 4 (SQLCipher) — natif, rebuild, coordonner avec SSL
6. Task 1 (App Integrity) — plus complexe, dernier

## Risques

- **App Integrity** : configuration Apple/Google fastidieuse ; bugs en sandbox ≠ prod
- **SSL pinning** : rotation cert casse l'app si OTA rate → **runbook obligatoire**
- **SQLCipher** : rebuild natif, les workflows preview/prod cassent tant que la lib n'est pas propagée
- **a11y** : test manuel long ; prioriser les 4 screens les plus utilisés avant d'auditer les 40+
