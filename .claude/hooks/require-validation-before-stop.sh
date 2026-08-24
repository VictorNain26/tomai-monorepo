#!/usr/bin/env bash
# Stop — n'autorise pas à quitter sur du TypeScript que CETTE session a édité et
# laissé non commité.
#
# Trois garde-fous contre le blocage en boucle, qui est le défaut classique de ce
# hook :
#   - il ne regarde que les fichiers listés dans le marqueur, jamais tout l'arbre,
#     donc du travail en cours qui ne vient pas de la session ne le déclenche pas ;
#   - il consomme le marqueur ;
#   - il ne se redéclenche pas si Claude a déjà été relancé par un hook Stop
#     (`stop_hook_active`), sinon corriger un lint ré-arme le marqueur et le
#     blocage se répète.
set -uo pipefail

input=$(cat)

command -v jq >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$input" | jq -r '.session_id // empty')
case "$session" in
  '' | */* | .*) exit 0 ;;
esac

marker="${TMPDIR:-/tmp}/claude-ts-edited-${session}"
[ -f "$marker" ] || exit 0

# Consommé dans tous les cas : une seule tentative de blocage par salve d'édition.
edited=$(sort -u "$marker")
rm -f "$marker"

[ -n "$edited" ] || exit 0

# Déjà relancé par un hook Stop : ne pas insister, sous peine de boucler.
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

repo="${CLAUDE_PROJECT_DIR:-.}"
pending=$(
  {
    git -C "$repo" diff --name-only -- '*.ts' '*.tsx'
    git -C "$repo" diff --cached --name-only -- '*.ts' '*.tsx'
    git -C "$repo" ls-files --others --exclude-standard -- '*.ts' '*.tsx'
  } 2>/dev/null | sort -u
)
[ -n "$pending" ] || exit 0

# Intersection : uniquement ce que la session a édité ET qui reste non commité.
culprits=$(printf '%s\n' "$pending" | grep -Fx -f <(printf '%s\n' "$edited") 2>/dev/null)
[ -n "$culprits" ] || exit 0

{
  echo "TypeScript édité dans cette session et non commité :"
  printf '  %s\n' $culprits
  echo "Lance la validation (typecheck + lint + tests), fais relire, puis commit avant de t'arrêter."
} >&2
exit 2
