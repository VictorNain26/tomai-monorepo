# Tom — Constitution du repo

> Contraintes universelles que les agents IA et contributeurs humains doivent respecter.
> Ce document est la source de vérité des règles inviolables. Les CLAUDE.md apportent du contexte opérationnel complémentaire.

## Règles TypeScript

- **Zéro `any`** : utiliser `unknown` + narrowing, jamais `any`.
- **Null-safety explicite** : gérer `null` et `undefined` explicitement, pas de `!` non-null assertion sauf commentaire justifiant.
- **Strict mode** activé, `noUncheckedIndexedAccess` activé.
- **400 lignes max par fichier** : si dépasse, découper avant commit.
- **Zéro warning ESLint** en CI.

## Règles Git & CI

- **Branches** : `staging` = travail quotidien, `main` = production. **JAMAIS de push direct sur `main`**.
- **Merge commits uniquement** : JAMAIS squash merge (désynchronise les branches).
- **Commits atomiques** : un commit = un changement cohérent. Pas de commits "WIP" en PR finale.
- **Stager explicitement** : toujours `git add <fichier>`, jamais `git add .` ni `-A`.
- **Messages de commit** : format conventional-commits (`feat`, `fix`, `docs`, `chore`, etc.) avec scope (`chat`, `server`, `landing`, `mobile`, `ci`, `db`, `auth`, `rag`).

## Règles Agents IA

- **Agents autorisés à** : merger vers `staging`, déployer en preview (Vercel preview, Koyeb staging, EAS preview), créer/commenter issues et PRs, lancer tests et lints.
- **Agents INTERDITS de** : push sur `main`, merger PR vers `main`, déployer en prod (Koyeb prod, Vercel prod, EAS submit stores), force push, delete remote branches, lire `.env` ou secrets, exécuter `curl ... | bash`.
- **Approbation humaine requise pour** : tout merge vers `main` (via CODEOWNERS + Ruleset bypass vide), tout déploiement prod (via GitHub Environment `production` required reviewer), modifications de `.github/workflows/` ou de la constitution.
- **Garde-fous déterministes** : Rulesets GitHub + hooks Claude Code PreToolUse + egress allowlist workflows. Détails dans `docs/superpowers/specs/2026-04-24-phase-0-foundations-design.md` §4-5.

## Règles Qualité

- **Tests obligatoires** pour : services, validations Zod, middleware auth, endpoints critiques (chat, billing, webhook RevenueCat). Voir `.claude/rules/testing-and-commits.md`.
- **Pas de silent fallback** : si un système critique dégrade, fail-fast au boot ou erreur explicite à l'appel. Pas de "soft fail" avec log observabilité seul.
- **Evidence-based** : lire les patterns existants + docs officielles avant de modifier. Pas de sur-engineering.

## Règles Accessibilité

- **WCAG 2.1 AA** obligatoire (EAA en vigueur depuis juin 2025).
- Contrast 4.5:1, targets ≥44×44pt, `accessibilityLabel` et `accessibilityRole` systématiques mobile.

## Règles Sécurité & RGPD

- **Secrets** : fail-fast au boot si vars prod manquantes. Jamais committés (Gitleaks CI + `.env*` deny-list).
- **Pronote** : AES-256-GCM + PBKDF2 600K iterations, salt aléatoire par enregistrement.
- **RevenueCat webhooks** : secret partagé ≥32 chars, comparaison timing-safe, idempotence via `webhook_events`.
- **RGPD** : données éducatives en `fr-par` (Scaleway S3), RetentionPolicy documentée.

## Respect de la constitution

Les rules ici ne sont PAS des suggestions. Un PR qui enfreint une règle doit être refusé, même par un agent IA.

Si une règle doit évoluer : ouvrir une issue `chore:constitution`, obtenir approbation, mettre à jour ce fichier en PR séparée.
