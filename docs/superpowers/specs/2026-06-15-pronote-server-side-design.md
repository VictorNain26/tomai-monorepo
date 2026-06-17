# Pronote / suivi scolaire — Design consolidé

**Date** : 2026-06-15 · **Consolidé (vision lead)** : 2026-06-17
**Statut** : design validé (Victor, 2026-06-17) — **référence unique du chantier**

## 1. But & principe directeur

Tom est un copilote de scolarité. **Pronote est la source de vérité, et la connexion est obligatoire** : pas de Pronote connecté, pas de Tom utilisable. Toute identité et donnée élève provient de Pronote ; aucune source d'identité parallèle. **Scope : collège & lycée** (le primaire est hors scope — pas de notes, pas d'API exploitable).

## 2. Workflow d'inscription (parent & prof principal — identique)

1. Création du compte Tom (email / Google) + choix du rôle (parent / prof principal).
2. **Connexion Pronote (obligatoire)** : recherche d'établissement par géolocalisation/nom (`pawnote.geolocation` → l'URL de l'instance est résolue automatiquement, jamais saisie par l'utilisateur) → login → on obtient et stocke un **jeton** (jamais le mot de passe).
3. **Découverte** : lecture du compte → liste des élèves rattachés (les enfants pour un parent, les élèves de la classe pour un prof principal).
4. **Sélection** : l'utilisateur coche les élèves à activer.
5. **Activation** : pour chaque élève coché → compte élève créé, **nom/classe/établissement pré-remplis depuis Pronote**, username auto (`prenom.nom`), **mot de passe temporaire**, et le **lien élève↔resource Pronote**.
6. **Première connexion de l'élève** → il définit son propre mot de passe.

Multi-établissement : un même compte peut connecter plusieurs Pronote (fratrie dans des écoles différentes) ; la liste d'élèves est l'union.

## 3. Modèle de comptes & données (cible)

- **Plusieurs jetons Pronote par compte** (un par établissement). _[révision vs socle actuel : 1 jeton/compte]_
- **Un élève réel = un compte Tom unique, partagé.** Relation **plusieurs-à-plusieurs** adulte↔élève (parent(s) + prof principal), et non un `parentId` unique. _[révision vs socle actuel : `user.parentId`]_
- **Fusion par confirmation** : Pronote n'expose ni INE ni email sur les enfants/élèves vus (seulement le **nom** ; INE/email ne sont que sur le compte du titulaire — vérifié `Account` pawnote l.113/116). On rapproche par **nom + classe + établissement** et on **demande confirmation** (« un élève de cette classe porte ce nom, c'est le même ? ») — jamais de fusion automatique aveugle.
- **On ne se connecte JAMAIS au Pronote de l'élève** : on n'a pas ses identifiants (chaque membre a les siens), et le compte parent/prof voit **déjà toutes** ses données. L'identité est dérivée de ce que le titulaire voit (= déjà Pronote). Évite aussi de multiplier les connexions (détection).
- **Identifiants élève** : username auto depuis Pronote + **mot de passe temporaire** ; l'élève le change au 1er login (pas d'email élève → pas de code d'invitation).
- **Résolution de lecture** : élève → adulte rattaché → jeton de l'établissement → resource → appel pawnote (server-side).

## 4. Architecture technique

Port/adapter : `PronoteProvider` (interface normalisée) ↔ `PawnoteServerAdapter` (reverse-eng server-side, token-based) → demain `DocaposteAdapter` (officiel) / `EcoleDirecteAdapter`. Les clients (web/mobile) consomment l'API Tom, indépendante de la source.

- **Token-only au stockage** (jamais le mot de passe ; AES-256-GCM + PBKDF2 600K, clé EU). Token-only **au transit** seulement sur mobile.
- **Canaux de connexion** :
  - **Mobile** = WebView sur la page Pronote/EduConnect **officielle** (mot de passe ne transite pas, gère l'ENT nativement) — pattern Papillon (réécrit, pas leur code GPL).
  - **Web** = saisie identifiants façon **agrégateur** (Bankin'/Linxo) ; le backend fait `loginCredentials` (le navigateur ne peut pas appeler Pronote = CORS), mot de passe **transitoire jamais stocké**.
- **Lecture des données = server-side** via le jeton (alimente web + features ; cache de session mémoire + refresh à expiration).
- **Résolution établissement** : `pawnote.geolocation({latitude, longitude})` → liste d'établissements + URLs ; l'utilisateur choisit son école, l'URL reste invisible.

## 5. Sécurité & RGPD

Chiffrement au repos, hébergement EU, minimisation (jeton only), accès audité, consentement explicite à la connexion. Données de mineurs → **AIPD obligatoire** (différée, archi compatible). Effacement via pseudonymisation `retrieval_audit` + cascade `pronote_credentials`.

## 6. Blocages anticipés (œil de lead)

**🔴 Existentiels :**
- **Détection Index Education** (risque n°1) : reverse-eng server-side = IP unique, détectable/blocable. → doser les appels, cache TTL généreux, User-Agent app-mobile, monitoring du taux d'erreur, garder le mobile device-first dilué le plus longtemps. **Pas d'évasion IP** (mauvais signal juridique).
- **GPL-3.0 (pawnote) avant les stores** : pawnote dans le bundle mobile = contamination si distribué. → basculer le mobile sur l'**API serveur** avant la mise en store (serveur non distribué = SaaS loophole, conforme).
- **RGPD données mineurs** : AIPD obligatoire, consentement. → archi compatible, dossier juriste à faire.

**🟠 Majeurs :**
- **ENT/EduConnect** : pawnote ne fait pas l'ENT, le web non plus (CORS), scraping serveur fragile (garde anti-IP déc 2024). → WebView mobile gère l'ENT ; QR pour le web en ENT ; **le compte test mesurera l'ampleur**.
- **Dépendance reverse-eng fragile** : Pronote peut casser pawnote à une mise à jour. → version-lock, monitoring, **voie officielle Docaposte** (B2B, par établissement, payant) comme pérennité — le reverse-eng est le *pont*.
- **Token rotatif** : durée de vie + coexistence device/serveur non validées. → dérisquer sur vrai compte.

**🟡 Gérables :**
- Multi-établissement (plusieurs jetons). Scaling multi-instance (cache mémoire non partagé → sticky-session, optimiser plus tard). Dédup élève (confirmation). Prof = ~30 élèves (sélection par classe, mots de passe auto). Reconnexion (`PronoteReauthRequired` → UX fluide).

## 7. Phasage

- **Fait — socle backend (prouvé e2e sur le compte démo)** : `PronoteProvider` + `PawnoteServerAdapter` (token), cache de session, table `pronote_child_resources`, service de résolution, endpoints + autorisation. **Construit sur l'ancien modèle** (1 jeton/compte, `parentId` unique).
- **À faire** :
  1. **Évolution du modèle** : multi-jeton par compte, élève partagé (relation plusieurs-à-plusieurs adulte↔élève), fusion-confirmation.
  2. **Onboarding** : géoloc établissement → connexion → découverte des élèves → activation (création comptes élèves + mappings).
  3. **E2e vrai compte** (token rotatif réel, multi-enfants).
  4. **Web** (agrégateur) → **Mobile WebView** (+ retrait pawnote du bundle = GPL réglé) → **ENT** → **EcoleDirecte**.

## 8. Hors scope

Primaire (pas de notes/API), dossier juriste/AIPD (différé), partenariat Docaposte (piste pérennité), réutilisation de code Papillon (on s'inspire du pattern, jamais leur code — GPL).

## 9. Sources vérifiées

- pawnote 1.6.2 types (`apps/server/node_modules/pawnote/dist/index.d.ts`) : `geolocation` (l.1689), `Account.email`/`Account.INE` (l.113/116, **titulaire seulement**, pas les resources), `loginCredentials`/`loginToken`/`loginQrCode` (pas d'ENT), `gradesOverview`/`assignmentsFromIntervals`/`timetableFromIntervals`.
- ENT/EduConnect SAML2 : pronotepy `_educonnect`. CORS web : type `Fetcher` (navigateur non supporté). Pattern WebView : Papillon `browser.tsx`.
- Géoloc prouvée : Collège Marseilleveyre → `https://0131923v.index-education.net/pronote`.
- Compte démo : `demonstration`/`pronotevs` sur `demo.index-education.net` (`loginToken` non supporté sur le démo → token rotatif à prouver sur vrai compte).
