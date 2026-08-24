#!/usr/bin/env bash
# PostToolUse(Edit|Write) — note QUELS fichiers TypeScript cette session a touchés.
#
# Le marqueur stocke les chemins, pas seulement le fait qu'il y a eu une édition :
# c'est ce qui permet au hook Stop de ne parler que du travail de la session, et
# pas de ce que l'arbre contenait déjà.
#
# Portée assumée : seules les éditions passant par Edit/Write sont vues. Du
# TypeScript écrit par un heredoc, un sed ou un codegen n'arme rien.
set -uo pipefail

input=$(cat)

command -v jq >/dev/null 2>&1 || exit 0

path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

# Hors du dépôt (script jetable dans /tmp) : rien à valider ni à commiter.
repo="${CLAUDE_PROJECT_DIR:-}"
[ -n "$repo" ] || exit 0
case "$path" in
  "$repo"/*) ;;
  *) exit 0 ;;
esac

session=$(printf '%s' "$input" | jq -r '.session_id // empty')
case "$session" in
  '' | */* | .*) exit 0 ;; # jamais de séparateur ni de . initial dans le nom de fichier
esac

marker="${TMPDIR:-/tmp}/claude-ts-edited-${session}"
if ! printf '%s\n' "${path#"$repo"/}" >>"$marker" 2>/dev/null; then
  printf '%s\n' '{"systemMessage":"Impossible d écrire le marqueur d édition TypeScript : le garde-fou de validation avant arrêt est inactif."}'
fi

exit 0
