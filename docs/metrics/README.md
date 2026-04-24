# Metrics — Tom monorepo

> Observabilité du projet (pas de l'app). Utilisé pour mesurer l'impact des phases workflow.

## Fichiers

- `quotas.md` — seuils free tier (voir Task 8)
- `baseline-2026-04.md` — état au lancement Phase 0 (snapshot immutable)
- `snapshots/YYYY-MM.md` — mensuels, générés par agent Phase 2

## Métriques suivies

| Métrique | Définition | Source |
|---|---|---|
| time-to-ship | Temps médian entre merge PR → deploy prod, 30 derniers jours | `gh pr list` + Vercel/Koyeb/EAS deploy timestamps |
| MTTR | Mean Time To Recovery — temps entre incident ouverture issue → close | GitHub issues label `incident` |
| bug rate | Issues label `bug` closed / semaine, 8 dernières semaines | `gh issue list` |
| test coverage server | `bun run test --coverage` | Bun runner |
| test coverage mobile | `pnpm test --coverage` | jest-expo |
| agent PR merge rate | % de PRs ouvertes par agents mergées sans modif humaine | `gh pr list --search "author:app/claude-code"` + status |

## Génération

```bash
bash scripts/compute-baseline.sh > docs/metrics/snapshots/$(date +%Y-%m).md
```

## Historique

- 2026-04 : baseline (ce phase 0)
