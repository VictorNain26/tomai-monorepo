# Vie scolaire (Pronote & co.) — Design port/adapter + auth WebView

**Date** : 2026-06-15 · **Révisé** : 2026-06-16 (après recherche doc-first multi-axes)
**Statut** : design à valider (avant writing-plans)

**Décisions business actées** :
- Reverse-eng comme **pont** vers la voie officielle (connecteur Docaposte, B2B), identifiants/token côté serveur **déchiffrables** pour les features en arrière-plan, sécurité renforcée. Dossier juriste + AIPD différés (Victor 2026-06-15). Tomia **pas encore sur les stores**.
- **Correction 2026-06-16** (issue de la recherche) : l'auth ENT ne peut pas se faire « le serveur saisit le mot de passe ». On adopte le **pattern WebView de Papillon** (réécrit, jamais leur code GPL) : l'utilisateur se logue lui-même, on récupère un **token Pronote rotatif**, et seule la **lecture des données** est server-side.

## But

Sortir l'accès « vie scolaire » du modèle « tout sur le device » vers une **abstraction port/adapter** dont la source est interchangeable (reverse-eng aujourd'hui → connecteur officiel demain), **sans refonte des clients**, et débloquer l'accès sur le **web** (impossible en client-side à cause du CORS). Couvrir le **secondaire** (Pronote + EcoleDirecte en priorité) ; le **primaire** est hors agrégation V1 (voir §Primaire).

## Contexte vérifié (recherche 2026-06-16)

### Paysage des systèmes (secondaire — collège/lycée)

| Système | Couverture | Accès | Lib server-side |
|---|---|---|---|
| **Pronote** (Index Education) | ~94 % (>10 000 / ~10 680 étab.) | direct **ou** via ENT | `pawnote` (TS, GPL-3.0, à jour 09/2025) |
| **EcoleDirecte** (Aplim) | surtout privé sous contrat, ~5,5 M users | login direct (pas d'ENT) | libs TS alpha/abandonnées (à durcir) |
| **Skolengo** (Kosmos) + ENT régionaux | >3 600 étab. (couche SSO au-dessus de Pronote) | ENT/EduConnect | `skolengojs` / `scolengo-api` (TS, GPL-3.0) |

Référence marché : l'app communautaire **Papillon** agrège déjà Pronote + EcoleDirecte + Skolengo derrière une abstraction — ce qui valide notre choix port/adapter.

### Le verrou central : l'authentification, pas le logiciel

- **Fait vérifié (code lu)** : `pawnote` **ne supporte pas l'ENT** (« not and will never be supported »). Surface d'auth = `loginCredentials` / `loginToken` / `loginQrCode` uniquement. Le bypass ENT (`bydlg=…&login=true`) ne marche **que si l'accès direct Pronote est ouvert**.
- Depuis la rentrée 2024, de nombreux établissements (IDF, Normandie, Hauts-de-France, Bretagne, Grand Est…) **forcent** l'entrée par l'ENT + **EduConnect** (SAML2, IdP Shibboleth `educonnect.education.gouv.fr/idp/profile/SAML2/Redirect/SSO`). FranceConnect côté parent uniquement.
- **`pronotepy` (Python)**, lui, fait l'ENT en HTTP pur (scraping SAML, 42 connecteurs ENT). Mais EduConnect a depuis **décembre 2024** un garde anti-IP-inconnue → un login depuis une **IP serveur** peut déclencher un challenge humain par email. Le scraping SAML server-side est donc **fragile pour onboarder à l'échelle**.
- **Pattern robuste éprouvé (Papillon, en prod)** : WebView pilotée par l'utilisateur (ENT → EduConnect → Pronote) → interception du **jeton d'appairage app-mobile** → `pawnote.loginToken()` pour toutes les sessions suivantes. **Aucun mot de passe ENT ne transite ni n'est stocké.**

### Web vs mobile (déterminant)

- **Web (navigateur)** : appeler Pronote/ENT en client-side est **structurellement impossible** — pas de CORS permissif, et le `fetch` navigateur ne peut ni lire les `Set-Cookie` ni gérer `redirect: "manual"` (requis par la chaîne CAS/SAML). → **proxy serveur obligatoire** pour lire les données ; l'auth ENT en web = **popup/redirection** WebView pilotée par l'utilisateur.
- **Mobile (React Native)** : `fetch` RN non soumis à la same-origin → `pawnote` tourne **nativement** ; la **WebView native** porte l'auth ENT (pattern Papillon).

## Architecture : port/adapter + auth séparée des données

```
apps/web ──┐ (popup/redirect WebView pour l'auth, proxy serveur pour les données)
           ├─> API Tom /api/pronote/* (Eden Treaty, @repo/api)
apps/mobile ┘ (WebView native pour l'auth, device-first pour les données jusqu'aux stores)
                     ▼
        PronoteProvider (PORT — interface normalisée, source-agnostique)
          connect(tokenInput) · getHomework() · getGrades() · getTimetable() · disconnect()
                     │
            ┌────────┴────────────┐
   PawnoteServerAdapter      (futur) DocaposteAdapter / EcoleDirecteAdapter
   reverse-eng server-side        connecteurs officiels / autres sources
```

- **Port** : interface stable consommée via l'API Tom. Données normalisées (types `@repo/api`), indépendantes de la source.
- **Adaptateur** : `PawnoteServerAdapter` implémente le port via `pawnote`, **côté serveur**, **à partir d'un token** (jamais d'un couple login/mot de passe ENT).

## Modèle d'authentification (le cœur — révisé 2026-06-16)

**Règle invariante** : **on ne stocke JAMAIS le mot de passe — seulement un jeton de session révocable (token-only AU STOCKAGE).** La lecture des données via le jeton est server-side.

**Canaux de connexion (décision UX 2026-06-17, modèle agrégateur) :**
- **Mobile** : WebView sur la page Pronote/EduConnect **officielle** → le mot de passe **ne transite jamais** par nous, on récupère le jeton (pattern Papillon). Gère l'ENT nativement.
- **Web** : saisie identifiant/mot de passe Pronote dans Tom (modèle agrégateur type Bankin') → le backend fait `loginCredentials` (proxy, le navigateur ne peut pas appeler Pronote = CORS) → le mot de passe **transite en mémoire serveur le temps de l'échange puis est jeté**, seul le jeton est stocké. Marche en accès direct ; **l'ENT sur le web reste le point dur** (scraping EduConnect serveur fragile, garde anti-IP déc. 2024).
- **Pas de rebond web→mobile.** Chaque canal est autonome.
- Token-only **au stockage** garanti partout ; token-only **au transit** seulement sur mobile.
- Conséquence : un chemin `loginCredentials` revient en prod **délibérément** (endpoint de connexion web), distinct du helper test-only sorti du code.

1. **Acquisition du token (côté client)** :
   - **Mobile** : WebView native (incognito, User-Agent app-mobile Pronote). L'utilisateur fait son flow (accès direct **ou** ENT/EduConnect). On intercepte le **jeton d'appairage app-mobile** Pronote.
   - **Web** : popup/redirection équivalente. Même résultat : un jeton d'appairage.
   - **Cas accès direct** (établissements sans ENT, démo, beaucoup de privé) : alternative QR code (`loginQrCode` + PIN) ou credentials directs, déjà supporté par `pawnote`.
2. **Échange & stockage (serveur)** : le client envoie le jeton d'appairage à l'API Tom → le serveur appelle `pawnote` pour obtenir le **token de reconnexion** (`nextTimeToken`), le **chiffre** et le persiste (`pronote_credentials`, **token only**).
3. **Lecture des données (serveur)** : `authenticateToken` → notes/devoirs/EDT. **Token rotatif** : `pawnote` en émet un nouveau à chaque session → on **re-chiffre et re-persiste** après chaque usage.

**On ne stocke jamais** : mot de passe ENT, mot de passe Pronote, cookies SAML. Seulement le token rotatif.

## Modèle de comptes & données (inchangé)

Un compte **parent/enseignant** (principal, payant) possède des comptes **enfants/élèves** (`parentId`). **La connexion vie scolaire est faite UNIQUEMENT par le parent/enseignant**, à la création/import de l'enfant. L'élève **consulte** son dashboard mais **ne connecte jamais** la source lui-même (contrôle parental + conformité données mineurs).

- **Le token est TOUJOURS au niveau du compte parent/enseignant** (`pronote_credentials.userId` = compte principal).
- **Mapping `enfantTom → resource Pronote`** : aujourd'hui sur le device (`resourceMappings` MMKV) → **à persister côté serveur** (table `pronote_child_resources`, à trancher dans le plan). Un login parent couvre **N enfants** (resources).
- **Résolution à un seul niveau** : `getGrades(childId)` → parent de `childId` → son token → resource de `childId` → appel. L'élève qui consulte déclenche la même résolution via le token du parent.
- **Cache de session par compte parent/enseignant.**

## Modèle de session

- **Cache de sessions `pawnote` en mémoire** (par user, TTL court), refresh **à expiration**. Pas de re-login par requête (latence + pattern détectable).
- Token rotatif **re-chiffré et persisté** après chaque usage.
- **Multi-instance** (Koyeb scale horizontal) : cache mémoire non partagé. V1 : sticky-session ou re-login par instance ; documenter, mesurer, **pas de cache distribué prématuré**.
- **Coexistence mobile-device / serveur** sur un même compte : sessions séparées (token rotatif distinct ?). Comportement réel de Pronote **à prototyper tôt** (inconnue listée).

## Sécurité

- Stockage chiffré AES-256-GCM + PBKDF2 600K (`lib/encryption.ts` réutilisé), clé maître `PRONOTE_ENCRYPTION_KEY` (env, EU).
- Clair **uniquement en mémoire**, le temps de l'appel — jamais persisté, jamais loggé.
- **Minimisation** : **token rotatif uniquement** (jamais de mot de passe — l'ENT/QR/WebView donne un token).
- Accès **audité** (`retrieval_audit`), hébergement **EU** (Koyeb fra + Postgres EU).
- **Consentement explicite** à la connexion (modèle agrégateur).
- Effacement : pseudonymisation `retrieval_audit` + cascade `pronote_credentials` déjà en place. AIPD + revue juridique différées, archi compatible.

## Primaire — hors agrégation V1

**Fait vérifié** : pas de notes chiffrées (évaluation par compétences, **LSU** 4 niveaux). LSU consultable par les parents via EduConnect → Scolarité Services **mais sans API** (flux XML école→ministère uniquement). ENT primaires fragmentés par commune (Beneylu, ONE/Edifice, Educartable…) **sans lib exploitable**.

**Position** : l'agrégation automatique du primaire **n'est pas faisable** aujourd'hui sans (a) devenir soi-même l'ENT (lourd, B2B), ou (b) **OCR du livret LSU PDF importé par le parent** (réutilise notre brique OCR Mistral). → **Hors V1** ; OCR-livret en option différée.

## Contrainte de design : détection Index Education

Risque **existentiel** aggravé par le server-side (IP unique). Mitigations dès la conception :
- **Garder le mobile device-first** le plus longtemps (volume dilué sur IP résidentielles) — migrer qu'aux stores.
- **Doser** les appels serveur : pas de sync background agressif, cache TTL généreux, pas de polling.
- **User-Agent** app-mobile Pronote (Pronote le vérifie).
- **Monitoring** du taux d'erreur Pronote pour réagir vite.
- Pas d'évasion IP (mauvais signal juridique, fragile). On assume + on dose.

## Phasage (chaque phase : prouvée e2e via vraie route + tests)

0. **Dérisquage sur le compte démo public** (`demonstration`/`pronotevs` sur `demo.index-education.net`) : prouver `loginCredentials` → `loginToken` → lecture notes/devoirs/EDT côté serveur, et mesurer le token rotatif. **Zéro donnée de mineur.**
1. **Fondation backend** : port `PronoteProvider` + `PawnoteServerAdapter` (token-based) + modèle de session + sécurité (token-only) + table `pronote_child_resources` + endpoints `/api/pronote/{connect,homework,grades,timetable,disconnect}`. Prouvé e2e sur démo. **Mobile intact (device-first).**
2. **Web** : popup WebView pour l'auth + branchement des endpoints (greenfield, faible volume → faible détection). **→ débloque la demande web.**
3. **Mobile** : reste device-first jusqu'aux stores ; alors bascule (retirer `pawnote` du bundle → API). **→ règle le GPL au moment où il devient réel.**
4. **Couverture ENT** : WebView d'auth (pattern Papillon réécrit) côté mobile + popup côté web. **Prototyper tôt** sur un vrai compte ENT-only.
5. **EcoleDirecte** : second adapter (lib à durcir/réécrire). **Durcissement** : codes d'erreur typés, retry/UI, version-lock libs.

## Ce que ça remplace / impacte

- Le `pronoteContext` envoyé par le device au chat → remplacé par les données serveur (à terme).
- `pronote-sync.service.ts` (stockage credentials) → étendu en provider complet, **bascule password→token**.
- Logique Pronote mobile (`pronote-session`, `usePronote`, stores) → migre côté serveur **à l'étape stores**.

## Risques ouverts (à dérisquer en priorité)

1. **Durée de vie du token rotatif** (mesurer sur démo).
2. **Garde anti-IP EduConnect** (déc. 2024) : impact sur l'auth web server-side.
3. **Coexistence de deux sessions** (mobile device + serveur web) sur un même compte.
4. **Robustesse de l'injection JS WebView** selon l'ENT (variations académiques).
5. **Détection Index Education** sous volume croissant.

## Hors scope

Dossier juriste, AIPD, partenariat Docaposte (B2B), agrégation primaire automatique, **réutilisation de code Papillon** (on s'inspire du pattern, on réécrit — GPL-3.0).

## Sources clés (vérifiées)

- `pawnote` API (surface auth, pas d'ENT) : npm `pawnote@1.6.2` `index.d.ts` ; README PasTrik/Pawnote (« ENT … not and will never be supported »).
- Compte démo : exemple canonique pawnote + pronotepy (`demo.index-education.net`, `demonstration`/`pronotevs`).
- ENT/EduConnect SAML2 : `pronotepy/ent/generic_func.py` (`_educonnect`), docs.index-education.com (« EduConnect, SAML2, Ws-Federation »).
- Pattern WebView : PapillonApp/Papillon `browser.tsx` (`react-native-webview` + injection JS + `postMessage` → `loginToken`).
- CORS web : type `Fetcher` `@literate.ink/utilities` (navigateur non listé) + sémantique CORS (MDN).
- Primaire/LSU : eduscol (LSU 4 niveaux), GAR (SSO ressources, pas vie scolaire).
- Licences : pawnote/skolengojs/scolengo-api GPL-3.0 (server-side non distribué = OK ; bundle mobile = contamination).
