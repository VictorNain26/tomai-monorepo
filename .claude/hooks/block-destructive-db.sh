#!/usr/bin/env bash
# PreToolUse(Bash) — refuse ce qui détruit une base réelle.
#
# Les commandes destructives génériques (rm -rf, git reset --hard, force push…)
# sont déjà refusées par permissions.deny dans les settings utilisateur. Ce hook
# ne garde que le risque propre au dépôt : `drizzle-kit push` écrase le schéma
# sans migration, et il ne doit jamais viser autre chose qu'une base locale.
#
# Le filtre porte sur la FORME de l'invocation, pas sur la simple présence d'une
# chaîne : sans ça, un `grep db:push` ou un `echo` mentionnant prod se faisait
# refuser. Un garde-fou qui bloque la lecture finit par être désactivé.
set -uo pipefail

input=$(cat)

if ! command -v jq >/dev/null 2>&1; then
  # stdout, pas stderr : sur un PreToolUse en exit 0, stderr ne remonte qu'au
  # journal de debug — l'absence du garde-fou serait donc silencieuse.
  printf '%s\n' '{"systemMessage":"jq est absent : le garde-fou base de données de ce dépôt est INACTIF. Installe jq."}'
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

# `--` obligatoire : plusieurs motifs commencent par un tiret, que grep prendrait
# sinon pour une option.
has() { printf '%s' "$command" | grep -qE -- "$1"; }

# Suppression de base ou de schéma. Comme pour `push`, on exige une vraie
# invocation d'un client base de données : sans ça, un message de commit ou un
# grep qui mentionne la phrase se fait refuser.
#
# Le client et le `drop` doivent appartenir à la MÊME invocation : `[^&|]*`
# interdit de traverser `&&`, `||` ou un pipe. Deux tests séparés sur la
# commande entière refusaient `grep "drop database" docs/ && bun run db:push`,
# où aucun drop n'a lieu. `;` n'est pas un séparateur ici : il sépare aussi les
# requêtes d'un `psql -c "SELECT 1; DROP DATABASE x"`, qui doit rester bloqué.
if printf '%s' "$command" | grep -qiE '(^|[;&|][[:space:]]*)([[:alnum:]_]+=[^[:space:]]*[[:space:]]+)*(sudo[[:space:]]+)?dropdb\b' ||
   printf '%s' "$command" | grep -qiE '\b(psql|pg_dump|mysql|drizzle-kit|db:)[^&|]*\bdrop[[:space:]]+(database|schema)\b'; then
  deny "Suppression de base ou de schéma refusée. Pour repartir d'une base locale propre : docker compose down -v puis pnpm run setup."
fi

# `push` de drizzle-kit, sous ses deux formes d'appel réelles dans ce dépôt :
# le script du package, ou un appel direct au binaire.
if has '(bun|pnpm|npm|yarn|npx|bunx)[[:space:]]+run[[:space:]]+db:push' ||
   has 'drizzle-kit[[:space:]]+push'; then

  # Un fichier de config dédié prod/staging — apps/server/drizzle.config.prod.ts existe.
  if has '--config[= ][^[:space:]]*(prod|staging)'; then
    deny "drizzle-kit push avec une config prod/staging est refusé : il écrase le schéma sans migration. Utilise bun run db:generate puis db:migrate."
  fi

  # DATABASE_URL forcée en ligne vers autre chose qu'une base locale.
  if has 'DATABASE_URL=' && ! has 'DATABASE_URL=[^[:space:]]*(localhost|127\.0\.0\.1)'; then
    deny "drizzle-kit push avec une DATABASE_URL non locale est refusé : il écrase le schéma sans migration. Utilise bun run db:generate puis db:migrate."
  fi

  if printf '%s' "$command" | grep -qiE '(prod|production|staging)'; then
    deny "drizzle-kit push visant prod/staging est refusé : il écrase le schéma sans migration. Utilise bun run db:generate puis db:migrate."
  fi
fi

exit 0
