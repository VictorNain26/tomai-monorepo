#!/usr/bin/env bash
# PreToolUse(Bash) — refuse ce qui détruit une base réelle.
#
# Les commandes destructives génériques (rm -rf, git reset --hard, force push…)
# sont déjà refusées par permissions.deny dans les settings utilisateur. Ce hook
# ne garde que le risque propre au dépôt, qu'aucune règle de permission ne sait
# exprimer : `db:push` écrase le schéma sans migration, donc il ne doit jamais
# viser autre chose qu'une base locale.
set -uo pipefail

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  echo "hook block-destructive-db: jq absent, garde-fou DB inactif" >&2
  exit 0
fi

command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
[ -n "$command" ] || exit 0

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

if printf '%s' "$command" | grep -qiE '\bdrop[[:space:]]+database\b'; then
  deny "DROP DATABASE refusé. Pour repartir d'une base propre en local : docker compose down -v puis pnpm setup."
fi

if printf '%s' "$command" | grep -qE 'db:push' &&
   printf '%s' "$command" | grep -qiE '(prod|production|staging)'; then
  deny "db:push est réservé au dev local (il synchronise le schéma sans migration). Pour prod/staging : bun run db:generate puis db:migrate."
fi

exit 0
