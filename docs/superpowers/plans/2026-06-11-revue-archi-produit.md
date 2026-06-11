# Revue architecture & produit — 2026-06-11

**Méthode** : orchestration multi-agents en 2 workflows (34 agents, ~1,24 M tokens sous-agents).
Exploration sonnet → jugement opus (archi, design system, contenu marketing) + revues sonnet par app → vérification adversariale sonnet de chaque finding critical/major (23 vérifiés : 20 confirmés, 0 réfutés, 3 reclassés).
Complète l'audit santé du 2026-06-07 (7,1/10, phases 0-4 livrées via PR #197-201) — ne re-couvre pas ce qui y a été corrigé.

## Scores par axe

| Axe | Score | Résumé |
|-----|-------|--------|
| Architecture monorepo | **8,0** | Contrat Eden Treaty réellement bout-en-bout, frontières propres, env Zod fail-fast. Frictions : 3 définitions de l'utilisateur, 4 listes de niveaux dupliquées. |
| Server | **7,8** | Structure saine, RAG hybride bien architecturé, défenses prompt-injection testées. MAIS : comptabilité tokens morte, `wrapUserMessage` sans strip. |
| Curriculum | **7,5** | Pipeline idempotent, contrat versionné testé des 2 côtés. Manque : cache uv CI, veille BO documentée mais inexistante. |
| Mobile | **7,2** | Streaming SSE robuste, stores chiffrés. Duplication QR/contexte chat, erreurs Pronote silencieuses, couverture 8 %. |
| AI service | **7,2** | Contrat server↔Python vérifié aligné, auth constant-time. Inférence synchrone bloque l'event loop (--workers 1). |
| Marketing contenu | **7,0** | Proposition de valeur forte (« comprendre, pas copier »), cible parent tenue. Stack EU non exploitée, incohérences marque/domaine. |
| Web | **6,2** | Squelette propre et YAGNI documenté. Crash runtime pour rôle admin, divergence contrat rôles, logout sans gestion d'erreur. |
| Marketing technique | **6,2** | Base SEO solide (JSON-LD, sitemap, robots). 5 pages sans metadata, PostHog absent, pages légales RGPD insuffisantes. |
| Design system | **6,0** | Source unique light OK, zéro hardcodé web/landing. Dark dupliqué et divergent, mobile entièrement déconnecté des tokens. |

**Score indicatif global : ~7,0/10** — codebase saine dans ses fondations, dettes concentrées sur 3 fronts : contrats de types non unifiés, dark/mobile hors design system, instrumentation produit (quota tokens, analytics) inopérante.

---

## Findings CRITIQUES (confirmés adversarialement)

### C1. Crash runtime à la connexion d'un utilisateur admin
`apps/web/app/login/page.tsx:38` — `ROLE_HOME[role]` avec `role='admin'` (présent dans l'enum DB `auth.schema.ts:13`, plugin Better Auth admin actif) donne `router.push(undefined)`. Le cast `as { role?: Role }` masque le trou au typecheck. **Aggravant confirmé** : `proxy.ts:34` re-route silencieusement tout admin en `parent` (`asRole(...) ?? "parent"`), non documenté. Effort S.
**Fix** : valider via `asRole()` avant `router.push`, ajouter un cas admin explicite (redirect /login + message, ou espace dédié).

### C2. Pages légales insuffisantes pour des données de mineurs (RGPD)
`apps/landing/app/confidentialite/page.tsx` (6 articles) — vérifié ligne par ligne : aucune durée de conservation, aucune procédure d'exercice des droits (Art. 15-20), aucun contact DPO/responsable, base légale invalide (« en utilisant l'app vous consentez »), sous-traitants non nommés (Mistral, Koyeb, Qdrant). CGU sans disposition mineurs. App ciblant explicitement CP-Terminale → non-conformité caractérisée Art. 13/14/28, exposition CNIL. Effort M (texte à valider par Victor).

## Findings MAJEURS confirmés

### Server
- **M1. Comptabilité tokens morte** — `mistral-chat.service.ts:344` : `usage` hardcodé à 0 dans le chunk `done` → `chat-orchestration.service.ts:289-307` ne déclenche JAMAIS `incrementTokenUsage` ni `costTrackingService.record`. Le fallback « infer from message length » promis en commentaire n'existe pas. Quota et suivi de coût silencieusement nuls en prod. Le SDK Mistral expose `usage` sur l'event final du stream — donnée disponible non lue. Effort S.
- **M2. `wrapUserMessage` sans strip délimiteur** — `mistral-helpers.ts:39-41` : asymétrie confirmée avec `wrapPronoteData` (l.69) et `wrapStudentContext` (l.95) qui strippent. Vecteur fence-breakout `</student_message>…<student_message>` ouvert, zéro test. Effort S.

### Architecture / contrats (run 1)
- **M3. Trois définitions divergentes de l'utilisateur** — `packages/api/src/types.ts:7` (IAppUser, non consommé), `apps/mobile/src/lib/auth.ts:36` (copie sans `selectedLv2`), `apps/web/lib/auth-client.ts:22` (rôle élargi `school` + cast `as AppUser` l.33). À unifier AVANT le premier écran web data-driven. Effort M.
- **M4. 4 listes t.Literal de niveaux dupliquées** — `parent.routes.ts:102-108` et `:143-149`, `deck.routes.ts:65-71`, `deck-discovery.routes.ts:9-15` — échappent au guard d'exhaustivité de `lib/education-levels.ts` ; le bon pattern existe déjà (`chat-message.routes.ts:148`). Effort S.
- **M5. Divergence rôles web/serveur** — `apps/web/lib/roles.ts:5` : `school` inexistant en base (placeholder documenté CLAUDE.md → OK), mais `admin` absent du type web = re-routage silencieux (cf. C1). Effort S.

### Design system (run 1)
- **M6. Dark mode sans source partagée** — `theme.css` est light-only (confirmé par son propre header) ; web et landing dupliquent 21-23 variables `.dark` avec divergences NON intentionnelles : `--color-card` `#0F172A` (web) vs `hsl(222 47% 13%)` (landing), `--color-violet` présent landing / absent web, formats hex vs hsl mélangés. Effort M.
- **M7. Mobile déconnecté des tokens** — `useThemeColors.ts:23` `primary: '#3B82F6'` vs token `#2563EB` (`theme.css:32`) ; toutes les valeurs redéclarées en dur ; `tokenNames` (garde-fou anti-dérive) consommé nulle part = inerte. Effort M.
- **M8. Composants UI mobile sur palette brute** — `button.tsx`, `card.tsx:15`, `input.tsx:21` mobile sur `stone-*`/`blue-*` littéraux au lieu de `bg-primary`/`bg-card` (pattern correct dans `packages/ui/src/components/button.tsx:11-23`). Reste 468 classes palette brute + 45 hex sur 80 fichiers (vs 863 avant). Effort M (composants) + chantier de fond (sweep).

### Web
- **M9. LogoutButton échec silencieux** — `components/logout-button.tsx:9` : pas de try/catch, pas d'état loading, unhandled rejection si réseau coupé. Effort S.

### Mobile
- **M10. Helpers QR dupliqués** — `parseQrCode` + `extractEstablishment` + génération username identiques entre `usePronoteOnboarding.ts:87-124` et `usePronoteReconnect.ts:69-105`. Point de validation de tokens Pronote : un fix appliqué d'un seul côté serait silencieusement absent de l'autre. Effort S.
- **M11. Contexte chat Pronote dupliqué** — `useStreamManager.ts:30-59` copie `usePronote.ts:216-230` caractère pour caractère, avec divergence de comportement déjà présente (retour `undefined` vs objet de champs undefined). `getChatContext` est par ailleurs du code mort (zéro appelant). Effort S.
- **M12. Erreurs Pronote avalées** — `usePronote.ts:130,164,199` : `catch { console.error }` sans état d'erreur ; store sans champ erreur ; appelants (`homework.tsx:37`, `grades.tsx:31`, `index.tsx:64`) sans compensation. Pull-to-refresh échoué = spinner disparaît, données vides, zéro message. Effort M.
- **M13. Couverture 8 %, flux critiques non testés** — `jest.config.js:35-40` ; zéro test pour usePronoteOnboarding (boucle création comptes enfants l.251-274), usePronoteReconnect, useVoiceInput, useTextToSpeech. Effort L.

### AI service / Curriculum / CI
- **M14. Inférence ML synchrone dans handlers async** — `main.py:79-89` → `_model.encode()`/`.rank()` CPU-bound (secondes) sans `run_in_executor`, Dockerfile `--workers 1` (l.58) : toute requête concurrente (y compris /health) bloquée pendant l'inférence. Effort S.
- **M15. CI Python sans cache uv** — `curriculum.yml:28` et `ai-service.yml:26` : `setup-uv` sans `enable-cache` (zéro occurrence dans tous les workflows), uv.lock pourtant commité. Réinstallation de centaines de Mo par run. Effort S.
- **M16. Veille BO fantôme** — `apps/curriculum/README.md:126` documente `veille_bo.yml` (hebdo, issue auto) ; le workflow n'existe pas. `veille_programmes.py` fonctionnel mais jamais exécuté en CI. Effort M (ou corriger le README si veille volontairement manuelle).

### Marketing
- **M17. 5 pages sans metadata** — seuls `layout.tsx` et `faq/page.tsx` exportent metadata ; /contact, /cgu, /confidentialite, /mentions-legales, /aide servent le title/description génériques. Effort S.
- **M18. PostHog absent de la landing** — zéro tracking (grep confirmé, package.json sans posthog-js) : taux de conversion waitlist non mesurable, source hero vs cta-bottom déjà passée au server action mais perdue. Effort M.

## Reclassés par la vérification adversariale (faits exacts, sévérité corrigée)

- **`useUser()` confond loading/non-auth** (`auth-client.ts:31`) — exact, mais zéro call site aujourd'hui + proxy server-side. → minor, « à exposer `isPending` avant le premier consommateur ».
- **« 13/15 use client »** — décompte gonflé : 3 fichiers réellement sur-marqués (`pricing.tsx` zéro interactivité, `problem-solution.tsx` via FadeIn extractible, `cta.tsx` directive redondante) ; les 5 autres sections justifiées. → minor.
- **Stack 100 % EU non exploitée** (`hero.tsx:36-46`, footer « Hébergé en Europe » sans nommer Mistral) — faits confirmés par grep exhaustif (zéro « Mistral/européen/souverain » dans les sections commerciales), reclassé « opportunité de conversion », pas un défaut de code. Reste l'argument différenciant n°1 face à ChatGPT (nommé 2× comme repoussoir sur la landing).

## Majeurs NON vérifiés (au-delà du cap de 18 vérifications) — à confirmer avant action

1. **Email contact sur mauvais domaine** — `contact/page.tsx:25` `contact@tomai.fr` vs domaine `tomia.fr` partout ailleurs (layout, robots, sitemap ×7). Si l'email est faux : mails parents perdus. **À vérifier en priorité (test d'envoi réel).**
2. **« Hébergé en France » (hero:43, faq:37) vs « Hébergé en Europe » (footer:26)** — contradiction sur le même scroll, sur l'argument confiance.
3. **« Tom » nu vs « TomIA » (52 occurrences)** — page aide notamment.
4. **Zéro preuve sociale** — ni témoignages, ni compteur waitlist, ni fondateurs (`page.tsx:80-88`).

## Mineurs / observations notables (sélection)

- Server : rate-limit et `activeSSEConnections` process-local (acceptable single-instance Koyeb, à documenter) ; `geminiFileId` champ fantôme encore propagé (`learning.schema.ts:117`, `chat-orchestration.service.ts:249`) ; 2 requêtes séquentielles parallélisables dans `getLearningContext` (`mistral-helpers.ts:112,123`) ; pas de timeout sur le handshake du fetch streaming (`mistral-client.ts:387`) ; `requireEmailVerification: false` à confronter à l'account-linking Google (`auth.ts:134`).
- Web : pas de `error.tsx`/`loading.tsx` ; `NEXT_PUBLIC_SERVER_URL` fallback localhost silencieux + pas de `.env.example` ; nav sans `aria-current`.
- Mobile : `daysUntil` local duplique `getDaysUntil` ; EAS production-android déclenché sur tout push main sans gate manuel ; commentaires « SDK 55 » périmés (6 fichiers).
- ai-service : pas de `[tool.pytest.ini_options]` ; chargement modèles synchrone dans lifespan (couvert par start-period 180 s) ; contrat server↔Python vérifié ALIGNÉ (RAS).
- Curriculum : `mistral-common` ~500 Mo en dépendance principale (usage = CLI ingest uniquement, import lazy déjà en place) ; pas de `.env.example` (6 vars requises) ; secret PISTE en argv curl (`veille_programmes.py:191`, pattern NamedTemporaryFile déjà présent l.226).
- Landing : sitemap `lastModified` figé au 2026-02-23 ; `remotePatterns hostname:'**'` ; pas de CSP (X-XSS-Protection obsolète présent) ; prix JSON-LD/pricing sans source commune ; fonts Geist mortes (~400 Ko) ; « 415 programmes Éduscol » dans le JSON-LD mais invisible pour l'humain ; « 30+ matières » vs 7 citées ; « commencez gratuitement » vs CTA waitlist.
- Archi : `prisma` dans `allowBuilds` (pnpm-workspace.yaml) sans usage ; ThemeProvider dupliqué web/landing ; décision actée : PAS de package @repo/hooks préventif (YAGNI), extraction dans @repo/api au 2e hook partagé.

---

## Plan phasé

### Phase 1 — Ce qui ment ou casse en prod (efforts S, 1-2 jours)
1. **Quota/coût tokens** : lire `usage` de l'event final du stream Mistral (SDK + chemin HTTP `finish_reason==='stop'`) — M1.
2. **`wrapUserMessage` strip + test fence-breakout** (aligné sur les 2 autres helpers) — M2.
3. **Rôle admin web** : `asRole()` au login + cas admin explicite au proxy — C1/M5.
4. **Email contact** : vérifier quel domaine est opérationnel, uniformiser, tester un envoi réel — non-vérifié n°1.
5. Listes t.Literal → `EDUCATION_LEVELS` (4 routes) — M4.

### Phase 2 — Conformité RGPD (M, texte à valider par Victor)
Politique de confidentialité complète (droits Art. 15-20, durées, sous-traitants nommés, base légale consentement parental, contact) + CGU mineurs — C2. Pré-requis légal au lancement, pas une option.

### Phase 3 — Contrat utilisateur unifié (M, avant le 1er écran web data-driven)
`@repo/api` source unique de IAppUser : mobile importe (supprime la copie), web dérive (décision school/admin actée et documentée) — M3. Supprimer le cast `as AppUser`.

### Phase 4 — Design system : dark partagé + fondations mobile (M)
1. Bloc dark dans `@repo/tokens` (réconcilier card/violet, un seul format), web+landing importent — M6.
2. `useThemeColors` aligné sur les tokens + brancher (ou supprimer) `tokenNames` — M7.
3. button/card/input mobile → classes sémantiques — M8. Le sweep des 468 classes reste un chantier de fond découpable (décisions actées : emerald=premium ≠ success, blue lien vs info au cas par cas).

### Phase 5 — Robustesse apps (S/M, parallélisable par app)
- Mobile : extraire helpers QR (M10), consolider contexte chat + supprimer code mort (M11), remonter les erreurs Pronote en UI (M12), puis tests onboarding/audio (M13, L — viser 30 %).
- Web : LogoutButton (M9), `error.tsx`/`loading.tsx`, `useUser` avec `isPending`, `.env.example`.
- ai-service : `run_in_executor` sur /embed et /rerank (M14).
- CI : `enable-cache: true` sur les 2 workflows uv (M15) ; veille BO : créer le workflow ou corriger le README (M16).

### Phase 6 — Conversion landing (S/M, mesurer avant d'optimiser)
1. PostHog + événement `waitlist_joined` avec source (M18) — à faire EN PREMIER pour avoir une baseline.
2. Metadata des 5 pages (M17).
3. Cohérences : France/Europe, Tom/TomIA, 30+ matières, « gratuit » vs waitlist (non-vérifiés 2-3 + minors).
4. Différenciant Mistral/IA européenne dans hero + FAQ dédiée.
5. Preuve sociale (compteur waitlist, verbatims bêta) — dépend de matière première à collecter.

**Recommandation d'exécution** : chaque phase = 1 branche + 1 PR, exécution subagent-driven (implementer sonnet + spec-reviewer + code-reviewer par tâche), plans détaillés via writing-plans en opus. Phases 5 et 6 parallélisables avec 2-4.
