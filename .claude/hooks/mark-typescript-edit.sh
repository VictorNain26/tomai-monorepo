#!/usr/bin/env bash
# PostToolUse(Edit|Write) — note que CETTE session a touché du TypeScript.
#
# Le marqueur est ce qui permet au hook Stop de distinguer « la session a édité
# du code » de « le dépôt avait déjà des modifications en cours ». Sans lui, le
# garde-fou se déclenche sur du travail que la session n'a jamais touché.
set -uo pipefail

input=$(cat)

command -v jq >/dev/null 2>&1 || exit 0

path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')
case "$path" in
  *.ts | *.tsx) ;;
  *) exit 0 ;;
esac

session=$(printf '%s' "$input" | jq -r '.session_id // "unknown"')
: >"${TMPDIR:-/tmp}/claude-ts-edited-${session}" 2>/dev/null || true

exit 0
