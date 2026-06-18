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
2. **Connexion (capture mobile → push serveur)** : QR (canal MVP, déjà présent — l'app transmet le payload QR+PIN au serveur qui obtient le jeton via `loginQrCode`) ou WebView (fast-follow, parents sans l'app Pronote). Jamais le mot de passe. Jeton stocké server-side → les étapes 3-5 et la consultation sont ensuite accessibles **web et mobile**.
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
- **Capture du jeton sur mobile → poussée au serveur** (révision 2026-06-18 post-audit mobile). Deux canaux, tous deux **contournent l'ENT** et **ne font jamais transiter le mot de passe** :
  - **QR — canal MVP, déjà présent dans l'app** (`loginQrCode`). L'app scanne le QR mobile généré par l'app Pronote officielle du parent (post-auth ENT) + son PIN. **On réutilise l'écran QR existant.** Pour sortir pawnote du bundle (GPL, cf. §7), le mobile **n'appelle plus `loginQrCode` en local** : il transmet le payload `{qr, pin}` au serveur (`POST /api/pronote/connect/qr`) qui fait `loginQrCode` → jeton, chiffré et stocké. Couvre les parents qui ont déjà l'app Pronote (la majorité).
  - **WebView — fast-follow UX** : pour les parents **sans** l'app Pronote, l'app ouvre la page **officielle** de l'établissement (Pronote direct OU ENT/EduConnect/ATRIUM) ; l'utilisateur s'authentifie chez son établissement ; la WebView capture le jeton (pattern Papillon, réécrit — pas leur code GPL) et le pousse au serveur. Gère l'ENT nativement (≠ `loginCredentials` direct, cassé sur les écoles ENT).
- **Le jeton vit côté serveur** (chiffré). Une connexion (sur mobile) ⇒ données disponibles **partout** : découverte/activation et consultation passent par l'API Tom, accessibles **web ET mobile**. Le mobile passe de « device-first (jeton + lectures locales, pawnote dans le bundle) » à « capture + push, puis consommation de l'API Tom ».
- **Lecture des données = server-side** via le jeton (`loginToken`, résolution multi-jeton de l'incrément 1 ; cache de session mémoire + refresh ; token rotatif re-persisté).
- **`deviceUUID` généré et imposé par le serveur** (vérifié doc-first : le `deviceUUID` est un paramètre libre, et le jeton n'est valable que pour *ce* `deviceUUID` — `index.d.ts:1134`). Le serveur le génère au `connect/qr`, le persiste avec le credential, et le réutilise pour tous les `loginToken` → **multi-device natif** (web + mobile partagent le couple jeton/`deviceUUID` serveur ; le mobile n'en gère aucun).
- **Verrou de rotation du jeton** (vérifié doc-first : le jeton tourne à *chaque* `loginToken`, l'ancien est consommé). Les refresh concurrents sur un même credential doivent être **sérialisés** (l'inflight-dedup par `credentialId` du socle → verrou explicite) et le nouveau jeton **persisté avant** mise en cache — sinon double consommation = déconnexion.
- **Le QR server-side dérisque le token rotatif dès maintenant** : `POST /api/pronote/connect/qr` exécute `loginQrCode` → jeton → `loginToken` côté serveur, **sans attendre le front** — un test d'intégration alimenté par un vrai payload QR prouve le cycle prod (le démo ne le permet pas, cf. §10).
- **`loginCredentials` (formulaire identifiants) retiré du chemin prod** — ne marche que pour les écoles hors-ENT (minorité) et faisait transiter le mdp ; conservé **test-only** (écoles Pronote-direct, ex. compte démo, pour prouver découverte/activation/lectures sur données réelles).
- **Résolution établissement** : `pawnote.geolocation` → liste d'établissements + URLs ; sert à ouvrir la bonne page (QR : pré-remplir l'instance ; WebView : ouvrir la page officielle).

## 6. Sécurité & RGPD

Chiffrement au repos, hébergement EU, minimisation (jeton only), accès audité, consentement explicite à la connexion. Données de mineurs → **AIPD obligatoire** (différée, archi compatible). Effacement via pseudonymisation `retrieval_audit` + cascade `pronote_credentials`.

## 7. Blocages anticipés (œil de lead)

**🔴 Existentiels :**
- **Détection Index Education** (risque n°1) : reverse-eng server-side = IP unique, détectable/blocable. → doser les appels, cache TTL généreux, User-Agent app-mobile, monitoring du taux d'erreur. **Atténué par le principe non-bloquant** : si pawnote tombe, l'app garde sa valeur cœur (curriculum) — on perd la personnalisation, pas le produit. **Pas d'évasion IP** (mauvais signal juridique).
- **GPL-3.0 (pawnote) avant les stores** (vérifié doc-first) : pawnote est **GPL-3.0-or-later** (champ `license` npm), **pas AGPL**. Dans le bundle mobile propriétaire = œuvre combinée GPL → obligation d'ouvrir tout le code (analyse FSF) + précédent VLC/GNU Go retirés de l'App Store. **Côté serveur seul = conforme** (la GPL se déclenche à la distribution/« conveying », pas à l'usage SaaS ; pas de clause réseau car ≠ AGPL). → **pawnote hors du bundle sans exception** : le mobile ne fait que scanner (caméra + `JSON.parse`, aucun import pawnote) et consomme l'API. Repli permissif documenté : **`pronotepy` (MIT)** en microservice Python (cf. pérennité, §7 majeurs). *Réserve : la frontière « microservice serveur appelant une lib GPL ≠ conveying » mérite validation avocat avant prod commerciale.*
- **RGPD données mineurs** : AIPD obligatoire, consentement. → archi compatible, dossier juriste à faire.

**🟠 Majeurs :**
- **ENT/EduConnect = la norme dans le public** (dérisqué 2026-06-18 : Marseilleveyre `0131923v` est en **ENT ATRIUM** — source officielle ac-aix-marseille : « accès à Pronote par l'ENT ATRIUM, vous n'avez donc pas de codes Pronote ». ATRIUM couvre Aix-Marseille + Nice ; chaque région a son ENT). → **canal de capture = QR (déjà présent dans l'app, contourne l'ENT) en MVP, WebView en fast-follow** (parents sans l'app Pronote, gère l'ENT nativement) ; `loginCredentials` direct ne marche que pour les écoles hors-ENT. **Conséquence actée : capture mobile → push serveur** (§5). Le code `loginCredentials` est confirmé conforme à pawnote (revue doc-first) — l'échec venait de l'ENT, pas de notre intégration.
- **Dépendance reverse-eng fragile + pérennité pawnote** : Pronote peut casser pawnote à une mise à jour ; et **le repo GitHub de pawnote (LiterateInk) renvoie 404** aujourd'hui (le package npm `1.6.2` reste figé/installable). → **version-lock `1.6.2`**, monitoring du taux d'erreur, **plan de repli `pronotepy` (MIT, Python, maintenu)** en microservice aux côtés d'`apps/ai-service` — déclencheurs : pawnote non patché après une casse Pronote, OU avis juridique exigeant le MIT. Pérennité long terme : **voie officielle Docaposte** (B2B, par établissement, payant).
- **Token rotatif** : `loginToken` non encore prouvé sur un vrai compte (le démo le rejette ; les écoles ENT ne permettent pas `loginCredentials` pour obtenir un 1er jeton). → dérisquer via **`POST /api/pronote/connect/qr` côté serveur (B2-backend)** alimenté par un vrai payload QR (`loginQrCode → loginToken`), **avant** le front et indépendamment du démo.

**🟡 Gérables :**
- Multi-établissement (plusieurs jetons). Scaling multi-instance (cache mémoire non partagé → sticky-session, optimiser plus tard). Dédup enfant (confirmation). Changement d'établissement (nouveau profil, fusion manuelle future). Reconnexion (`PronoteReauthRequired` → UX fluide).

## 8. Phasage

- **Fait — socle backend lecture (prouvé e2e sur le compte démo)** : `PronoteProvider` + `PawnoteServerAdapter` (token), cache de session, table `pronote_child_resources`, service de résolution, endpoints + autorisation. **Construit sur l'ancien modèle** (1 jeton/compte, `parentId` unique).
- **Fait — incrément 1, partie 1 : évolution du modèle** (livré sur `feat/pronote-server-provider`, poussée) : multi-jeton `(user, établissement)`, jonction `parent_child` (plusieurs-à-plusieurs), mapping resource `(parent, jeton, enfant)` par `credential_id`, resync (clé naturelle). Migration des call-sites `parentId` → jonction. Migration prod `0023` (DDL pur, testée fresh-base). 59/59 unit + intégration verte, 2 revues opus.
- **À coder — incrément 1, partie 2 (B2)** :
  - **B2-backend** (indépendant du mobile, testable e2e sur le démo) : géoloc établissement, **`POST /api/pronote/connect/qr`** (capture server-side : payload QR+PIN → `loginQrCode` → jeton chiffré ; **dérisque le token rotatif**), **découverte** des enfants (`handle.user.resources`), **activation** (profils + mappings + fusion-confirmation), **resync** (US-12). **Pronote non bloquant** (coexiste avec `createChild` manuel).
  - **B2-front mobile** (refactor ciblé — audit 2026-06-18 : app saine **8,5/10**, **~87 % gardé**, ~3-4 j) : couche données Pronote device-first → consommation API Tom (réécrire `pronote-session.ts` + `usePronote.ts`, ~400 LOC, **0 écran consommateur cassé**, interface du hook étanche) ; **retrait de pawnote du bundle** (GPL réglé) ; QR transmis au serveur ; **pivot parent-only** (jeter espace élève autonome + `child-access-store` ~1 386 LOC, unifier les vues Pronote dupliquées ~1 100 LOC).
- **Reporté** (sans casser l'archi) :
  - **Compte élève autonome** (login élève : claim token / lien-QR de jumelage, ou magic-link via email saisi par le parent). S'ajoute par-dessus le profil existant.
  - **Espace enseignant** : pawnote n'expose **pas** de roster de classe (vérifié, §10) → source distincte requise (Docaposte officiel / EcoleDirecte). Le workflow prof n'est **pas** réalisable via pawnote.
  - **WebView ENT** (fast-follow UX, parents sans l'app Pronote), **EcoleDirecte**, front **web** (agrégateur, même API).

## 9. Hors scope

Primaire pour la partie Pronote (pas de notes/API ; le copilote curriculum reste accessible), dossier juriste/AIPD (différé), partenariat Docaposte (piste pérennité), réutilisation de code Papillon (pattern seulement, jamais leur code — GPL).

## 10. Sources vérifiées (pawnote 1.6.2 — `node_modules/.pnpm/pawnote@1.6.2/.../dist/index.d.ts`)

- `UserResource` (l.1345-1356) = `id, kind, name, className, establishmentName, profilePicture, …` → **aucun email/INE** sur les enfants/élèves vus.
- `Account.email` / `Account.INE` (l.113/116) → **titulaire connecté uniquement** (« email » n'apparaît que 2 fois dans 1882 lignes).
- `geolocation` (l.1689) → `Promise<Array<GeolocatedInstance>>` ; `GeolocatedInstance` (l.685-692) = `{ url, name, latitude, longitude, postalCode, distance }`.
- `loginCredentials` / `loginToken` / `loginQrCode` — **pas d'ENT**. Aucune fonction de **roster de classe** (la seule énumération nominative d'élèves = destinataires de messagerie `newDiscussionRecipients(EntityKind.Student)`, détournée) → **espace enseignant reporté**.
- Compte démo : `demonstration` / `pronotevs` sur `demo.index-education.net` (`loginToken` non supporté sur le démo → token rotatif à prouver sur vrai compte).
