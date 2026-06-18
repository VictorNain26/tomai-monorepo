# Pronote / suivi scolaire — Design consolidé

**Date** : 2026-06-15 · **Consolidé (vision lead finale)** : 2026-06-18
**Statut** : design validé (Victor, 2026-06-18) — **référence unique du chantier**

## 1. But & principe directeur

Tom est un copilote de scolarité. **Le cœur — le copilote pédagogique — fonctionne SANS Pronote** : le RAG curriculum (Qdrant + BGE-M3 sur le programme), le chat Mistral et le vocal Voxtral sont déjà livrés et tournent sans aucune donnée Pronote.

**Pronote est un amplificateur optionnel, fortement mis en avant — pas une barrière.** Il personnalise le copilote (notes, devoirs, emploi du temps → « tu as un contrôle de fractions vendredi, on révise ? »). La connexion **n'est jamais bloquante** : on ne met pas toute l'existence du produit en otage d'un reverse-eng hostile (cf. §6, détection Index Education).

**Différencié par rôle** (l'app est role-aware) :
- **Parent** (suivi : notes/devoirs/alertes) → Pronote est quasi indispensable à la valeur → poussé très fort, « ressenti » comme nécessaire par l'usage.
- **Élève** (apprendre/réviser) → le curriculum suffit → Pronote est un bonus.

**Scope Pronote : collège & lycée** (le primaire n'a pas de notes/API exploitable, mais peut utiliser le copilote curriculum). Le reverse-eng `pawnote` est le pont ; la pérennité passe par la voie officielle Docaposte (§6).

## 2. Modèle d'accès (progressive enhancement)

- Valeur **immédiate** dès l'inscription (copilote curriculum), **sans** Pronote.
- Écran « Connecte Pronote pour personnaliser » juste après l'inscription — **incité fort, skippable**.
- **Deux chemins de création d'enfant qui coexistent** :
  - **Manuel** : `parentService.createChild` (déjà dans le socle) — chemin sans Pronote.
  - **Peuplé par Pronote** : onboarding (découverte → activation) — quand l'adulte connecte.

## 3. Workflow onboarding Pronote (quand l'adulte choisit de connecter)

1. **Recherche d'établissement** par géolocalisation (`pawnote.geolocation({latitude, longitude})` → liste `{name, url}` ; l'URL de l'instance est résolue automatiquement, **jamais saisie**).
2. **Connexion** : login → on obtient et stocke un **jeton** (jamais le mot de passe).
3. **Découverte** : lecture du compte → liste des enfants rattachés (`UserResource` : nom, classe, établissement).
4. **Sélection** : l'adulte coche les enfants à activer.
5. **Activation** : pour chaque enfant → profil créé (nom/classe **pré-remplis depuis Pronote**, username auto `prenom.nom`) + lien `(parent, jeton, enfant) → resource_id`. Si un profil correspondant existe déjà (autre parent) → **rattachement par confirmation** (§4).

Multi-établissement : un même compte peut connecter plusieurs Pronote (fratrie dans des écoles différentes) ; la liste d'enfants est l'union.

## 4. Modèle de comptes & données (cible — incrément 1)

- **Plusieurs jetons Pronote par compte** (un par établissement). Clé `pronote_credentials (user_id, establishment_id)`. _[révision vs socle : `user_id` unique]_
- **Relation parent↔enfant plusieurs-à-plusieurs** (table de jonction `parent_child`), remplaçant le lien primaire `user.parentId` unique. **Nécessaire pour les parents séparés** : un enfant réel = un seul profil, partagé par ses deux parents. _[révision vs socle : `user.parentId`]_
- **Mapping resource par `(parent, jeton, enfant)`** : `pronote_child_resources (parent_user_id, child_user_id, credential_id, resource_id)` ; `child_user_id` n'est plus unique (l'id Pronote d'un enfant **diffère** d'un compte parent à l'autre).
- **`resource_id` est volatile** (révision annuelle) — jamais traité comme clé stable.
- **Fusion par confirmation** sur `(établissement, nom, classe)`. Pronote n'expose **ni INE ni email** sur les enfants vus — seulement le **nom** (vérifié : `UserResource` = id/kind/name/className/establishmentName/photo ; INE/email uniquement sur `Account` du **titulaire**, l.113/116). Jamais de fusion automatique aveugle ; homonymes exacts d'une même classe → la confirmation humaine tranche.
- **Resync à chaque (re)connexion** (cycle de vie / rentrée) : on relit les `UserResource` du jeton, on matche par clé naturelle `(parent, établissement, nom)`, on met à jour `resource_id` + classe ; un enfant disparu → profil **inactif** ; un nouveau → proposé à l'activation. _Limite honnête_ : un changement d'**établissement** (déménagement) crée un nouveau profil (pas d'INE pour suivre inter-établissement) ; fusion manuelle = évolution future.
- **Profil-enfant = `user role=student`** (déjà le cas via `createChild`), classe/établissement re-synchronisés depuis Pronote. **Pas de login élève activé** dans cet incrément (espace élève autonome = reporté, §8).
- **On ne se connecte JAMAIS au Pronote de l'élève** : on n'a pas ses identifiants, et le compte parent voit déjà toutes ses données. Évite aussi de multiplier les connexions (détection).

## 5. Architecture technique

Port/adapter : `PronoteProvider` (interface normalisée) ↔ `PawnoteServerAdapter` (reverse-eng server-side, token-based) → demain `DocaposteAdapter` (officiel) / `EcoleDirecteAdapter`. Les clients (web/mobile) consomment l'API Tom, indépendante de la source.

- **Token-only au stockage** (jamais le mot de passe ; AES-256-GCM + PBKDF2 600K, clé EU). Token-only **au transit** seulement sur mobile.
- **Canaux de connexion** :
  - **Mobile** = WebView sur la page Pronote/EduConnect **officielle** (mot de passe ne transite pas, gère l'ENT nativement) — pattern Papillon (réécrit, pas leur code GPL).
  - **Web** = saisie identifiants façon **agrégateur** (Bankin'/Linxo) ; le backend fait la connexion server-side (le navigateur ne peut pas appeler Pronote = CORS), mot de passe **transitoire jamais stocké**.
- **Lecture des données = server-side** via le jeton (cache de session mémoire + refresh à expiration ; token rotatif re-persisté à chaque usage).
- **Résolution établissement** : `pawnote.geolocation` → liste d'établissements + URLs ; l'utilisateur choisit, l'URL reste invisible.

## 6. Sécurité & RGPD

Chiffrement au repos, hébergement EU, minimisation (jeton only), accès audité, consentement explicite à la connexion. Données de mineurs → **AIPD obligatoire** (différée, archi compatible). Effacement via pseudonymisation `retrieval_audit` + cascade `pronote_credentials`.

## 7. Blocages anticipés (œil de lead)

**🔴 Existentiels :**
- **Détection Index Education** (risque n°1) : reverse-eng server-side = IP unique, détectable/blocable. → doser les appels, cache TTL généreux, User-Agent app-mobile, monitoring du taux d'erreur. **Atténué par le principe non-bloquant** : si pawnote tombe, l'app garde sa valeur cœur (curriculum) — on perd la personnalisation, pas le produit. **Pas d'évasion IP** (mauvais signal juridique).
- **GPL-3.0 (pawnote) avant les stores** : pawnote dans le bundle mobile = contamination si distribué. → basculer le mobile sur l'**API serveur** avant la mise en store (serveur non distribué = SaaS loophole, conforme).
- **RGPD données mineurs** : AIPD obligatoire, consentement. → archi compatible, dossier juriste à faire.

**🟠 Majeurs :**
- **ENT/EduConnect** : pawnote ne fait pas l'ENT, le web non plus (CORS), scraping serveur fragile. → WebView mobile gère l'ENT ; QR pour le web en ENT ; **le compte test mesurera l'ampleur**.
- **Dépendance reverse-eng fragile** : Pronote peut casser pawnote à une mise à jour. → version-lock, monitoring, **voie officielle Docaposte** (B2B, par établissement, payant) comme pérennité.
- **Token rotatif** : durée de vie + coexistence device/serveur non validées. → dérisquer sur vrai compte.

**🟡 Gérables :**
- Multi-établissement (plusieurs jetons). Scaling multi-instance (cache mémoire non partagé → sticky-session, optimiser plus tard). Dédup enfant (confirmation). Changement d'établissement (nouveau profil, fusion manuelle future). Reconnexion (`PronoteReauthRequired` → UX fluide).

## 8. Phasage

- **Fait — socle backend lecture (prouvé e2e sur le compte démo)** : `PronoteProvider` + `PawnoteServerAdapter` (token), cache de session, table `pronote_child_resources`, service de résolution, endpoints + autorisation. **Construit sur l'ancien modèle** (1 jeton/compte, `parentId` unique).
- **Incrément 1 — à coder** :
  1. **Évolution du modèle** : multi-jeton `(user, établissement)`, jonction `parent_child` (plusieurs-à-plusieurs), mapping resource `(parent, jeton, enfant)`, resync. Migration des call-sites `parentId` → jonction.
  2. **Onboarding** : géoloc établissement → connexion → découverte des enfants → activation (création profils + mappings + fusion-confirmation). **Pronote non bloquant** (coexiste avec `createChild` manuel).
- **Reporté** (sans casser l'archi) :
  - **Compte élève autonome** (login élève : claim token / lien-QR de jumelage, ou magic-link via email saisi par le parent). S'ajoute par-dessus le profil existant.
  - **Espace enseignant** : pawnote n'expose **pas** de roster de classe (vérifié, §10) → source distincte requise (Docaposte officiel / EcoleDirecte). Le workflow prof n'est **pas** réalisable via pawnote.
  - **ENT**, **EcoleDirecte**, fronts **web** (agrégateur) et **mobile** (WebView, + retrait pawnote du bundle = GPL réglé).

## 9. Hors scope

Primaire pour la partie Pronote (pas de notes/API ; le copilote curriculum reste accessible), dossier juriste/AIPD (différé), partenariat Docaposte (piste pérennité), réutilisation de code Papillon (pattern seulement, jamais leur code — GPL).

## 10. Sources vérifiées (pawnote 1.6.2 — `node_modules/.pnpm/pawnote@1.6.2/.../dist/index.d.ts`)

- `UserResource` (l.1345-1356) = `id, kind, name, className, establishmentName, profilePicture, …` → **aucun email/INE** sur les enfants/élèves vus.
- `Account.email` / `Account.INE` (l.113/116) → **titulaire connecté uniquement** (« email » n'apparaît que 2 fois dans 1882 lignes).
- `geolocation` (l.1689) → `Promise<Array<GeolocatedInstance>>` ; `GeolocatedInstance` (l.685-692) = `{ url, name, latitude, longitude, postalCode, distance }`.
- `loginCredentials` / `loginToken` / `loginQrCode` — **pas d'ENT**. Aucune fonction de **roster de classe** (la seule énumération nominative d'élèves = destinataires de messagerie `newDiscussionRecipients(EntityKind.Student)`, détournée) → **espace enseignant reporté**.
- Compte démo : `demonstration` / `pronotevs` sur `demo.index-education.net` (`loginToken` non supporté sur le démo → token rotatif à prouver sur vrai compte).
