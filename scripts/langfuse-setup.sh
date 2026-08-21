#!/usr/bin/env bash
# =============================================================================
# Configure Langfuse pour ce dépôt, à partir d'une paire de clés API.
#
#   ./scripts/langfuse-setup.sh pk-lf-xxxx sk-lf-yyyy
#
# Récupérer les clés : Langfuse → Settings → API Keys → « Create new API keys »
# (le secret n'est affiché qu'une fois).
#
# Le script :
#   1. fabrique le token base64(publicKey:secretKey) — Langfuse s'authentifie
#      en HTTP Basic, il ne prend pas les deux clés séparément ;
#   2. affiche les 2 lignes à coller dans apps/server/.env (export OTLP) ;
#   3. enregistre le serveur MCP Langfuse dans Claude Code.
#
# Pourquoi OTLP et pas le SDK Langfuse : le serveur instrumente déjà ses appels
# Mistral avec les conventions GenAI d'OpenTelemetry (src/lib/otel/). L'export
# OTLP ne demande aucune ligne de code, et rester sur un standard permet de
# changer de destination plus tard sans toucher à l'instrumentation.
# =============================================================================
set -euo pipefail

readonly LANGFUSE_HOST="https://cloud.langfuse.com"

if [ $# -ne 2 ]; then
  cat >&2 <<USAGE
Usage : $0 <public-key> <secret-key>

  public-key   commence par pk-lf-
  secret-key   commence par sk-lf-

À récupérer sur $LANGFUSE_HOST → Settings → API Keys.
USAGE
  exit 1
fi

readonly PUBLIC_KEY="$1"
readonly SECRET_KEY="$2"

case "$PUBLIC_KEY" in pk-lf-*) ;; *) echo "Erreur : la clé publique doit commencer par pk-lf-" >&2; exit 1 ;; esac
case "$SECRET_KEY" in sk-lf-*) ;; *) echo "Erreur : la clé secrète doit commencer par sk-lf-" >&2; exit 1 ;; esac

readonly TOKEN=$(printf '%s:%s' "$PUBLIC_KEY" "$SECRET_KEY" | base64 -w0)

# ── 1. Export OTLP du serveur ────────────────────────────────────────────────
cat <<OUT

────────────────────────────────────────────────────────────────────────────
1. Traces du serveur — colle ces 2 lignes dans apps/server/.env
────────────────────────────────────────────────────────────────────────────

OTEL_EXPORTER_OTLP_ENDPOINT=$LANGFUSE_HOST/api/public/otel
OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic $TOKEN

Ne PAS ajouter /v1/traces à l'endpoint : otel.ts le fait déjà.

OUT

# ── 2. Serveur MCP ───────────────────────────────────────────────────────────
echo "────────────────────────────────────────────────────────────────────────────"
echo "2. Serveur MCP Langfuse"
echo "────────────────────────────────────────────────────────────────────────────"
echo

if ! command -v claude >/dev/null 2>&1; then
  echo "  claude introuvable dans le PATH — commande à lancer toi-même :"
  echo
  echo "  claude mcp add --transport http langfuse \\"
  echo "    $LANGFUSE_HOST/api/public/mcp \\"
  echo "    --header \"Authorization: Basic $TOKEN\""
  exit 0
fi

# Portée `local` volontairement : le header porte le secret. La portée
# `project` l'écrirait dans .mcp.json, qui est versionné — donc dans git.
if claude mcp add --transport http --scope local langfuse \
     "$LANGFUSE_HOST/api/public/mcp" \
     --header "Authorization: Basic $TOKEN"; then
  echo
  echo "  ✓ MCP « langfuse » enregistré (portée locale, hors git)."
  echo "    Vérifier : claude mcp list"
else
  echo
  echo "  ✗ L'enregistrement a échoué. S'il existe déjà :" >&2
  echo "      claude mcp remove langfuse   puis relancer ce script." >&2
  exit 1
fi
