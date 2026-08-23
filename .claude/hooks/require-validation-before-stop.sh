#!/usr/bin/env bash
# Stop — n'autorise pas à quitter sur du TypeScript édité par la session et
# laissé non validé.
#
# Deux garde-fous contre le blocage en boucle, qui est le défaut classique de ce
# hook : il ne se déclenche que si la session a réellement édité un .ts/.tsx
# (marqueur posé par mark-typescript-edit.sh), et il consomme ce marqueur, donc
# il bloque une fois puis rend la main.
set -uo pipefail

input=$(cat)

command -v jq >/dev/null 2>&1 || exit 0

session=$(printf '%s' "$input" | jq -r '.session_id // "unknown"')
marker="${TMPDIR:-/tmp}/claude-ts-edited-${session}"

[ -f "$marker" ] || exit 0
rm -f "$marker"

repo="${CLAUDE_PROJECT_DIR:-.}"
pending=$(
  {
    git -C "$repo" diff --name-only -- '*.ts' '*.tsx'
    git -C "$repo" diff --cached --name-only -- '*.ts' '*.tsx'
    git -C "$repo" ls-files --others --exclude-standard -- '*.ts' '*.tsx'
  } 2>/dev/null | head -1
)

[ -n "$pending" ] || exit 0

echo "TypeScript édité dans cette session et non commité. Lance la validation (typecheck + lint + tests), fais relire, puis commit avant de t'arrêter." >&2
exit 2
