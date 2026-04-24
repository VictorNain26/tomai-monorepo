# Quotas free tier — seuils et escalade

> Sert de référence pour `scripts/check-quotas.sh` et pour décider des upgrades éventuels.
> Dernière mise à jour : 2026-04-24

## GitHub Actions

- **Quota gratuit** : 2000 minutes/mois (private repos)
- **Seuil alerte** : 80% = 1600 min consommées
- **Action si dépassé** : désactiver workflows non-critiques, migrer sweeps vers Claude Code Routines
- **Upgrade** : pay-as-you-go (~$0.008/min Linux après le free tier)

## Claude Max 5x

- **Quota** : ~5× Pro (Anthropic ne publie pas le chiffre exact)
- **Fenêtres** : 5h rolling + 7 jours cumulatif
- **Seuil alerte** : estimation basée sur usage ratio (si >80% du quota hebdo observé sur les 3 derniers jours)
- **Action si dépassé** : basculer quelques workflows vers `claude-sonnet-4-6` ou `claude-haiku-4-5` (modèles moins coûteux côté quota), décaler routines hors peak EU/US
- **Upgrade** : Max 20x (~$200/mois)

## Sentry Free (Developer)

- **Quotas/mois** : 5K errors, 50 replays, 5M tracing spans, 1 uptime monitor, 1 cron
- **Seuil alerte** : 80% de chaque
- **Action si dépassé** : tune `beforeSend` pour drop les events verbeux, sampler `tracesSampleRate` plus bas
- **Upgrade** : Team $26/mo (50K errors, unlimited seats)

## PostHog Free

- **Quotas/mois** : 1M events, 5K replays, 100K errors, 2K Max AI credits
- **Seuil alerte** : 80% de chaque
- **Action si dépassé** : désactiver autocapture en mobile (events verbeux), sampler session replay
- **Upgrade** : usage-based (progressif, pas de cliff dur)

## Supabase Free

- **Quotas** : 2 projets, 500 MB DB/projet, pause après 1 semaine d'inactivité
- **Seuil alerte** : 80% de 500 MB sur staging
- **Action si dépassé** : purger historiques (chat_sessions anciennes, webhook_events > 7 jours déjà purgés par défaut)
- **Upgrade** : Pro $25/mo (branching inclus)

## Koyeb Free

- **Quotas** : 1 service web (512MB / 0.1 vCPU), scale-to-zero après 1h idle
- **Seuil alerte** : N/A (usage continu normal)
- **Action** : keepalive cron staging résout la lag de scale-to-zero
- **Upgrade** : Hobby $5.50/mo par service

## EAS Free

- **Quotas/mois** : 15 Android + 15 iOS builds, OTA updates ≤1000 MAU
- **Seuil alerte** : 12 builds/plateforme (80%)
- **Action si dépassé** : désactiver le preview-on-push staging si pas utilisé
- **Upgrade** : Production $19/mo (30 builds/plateforme)

## Escalade globale

Si ≥3 quotas atteignent 80% simultanément : déclencher revue d'architecture en Phase 2 (agent triage peut générer un rapport d'utilisation + propositions). Si ≥1 quota passe à 95% : upgrade immédiat du service concerné.
