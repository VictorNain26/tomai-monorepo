#!/usr/bin/env bash
# Check free-tier quotas for GH Actions, Sentry, PostHog, Supabase, EAS.
# Outputs a markdown report to stdout.
#
# Requires env vars:
#   SENTRY_ORG_TOKEN, POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, EXPO_TOKEN
# GitHub quota via gh CLI auth (must be authenticated).

set -euo pipefail

REPO="${REPO:-VictorNain26/tomai-monorepo}"

echo "# Quota report — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# --- GitHub Actions ---
echo "## GitHub Actions"
if GH_BILLING=$(gh api /users/$(gh api user --jq .login)/settings/billing/actions 2>/dev/null); then
  USED=$(echo "$GH_BILLING" | jq -r '.total_minutes_used // 0')
  INCLUDED=$(echo "$GH_BILLING" | jq -r '.included_minutes // 2000')
  PCT=$(awk "BEGIN { printf \"%.1f\", ($USED / $INCLUDED) * 100 }")
  echo "- Used: **$USED** / $INCLUDED min (**$PCT%**)"
  if awk "BEGIN { exit !($USED / $INCLUDED > 0.8) }"; then
    echo "- ⚠️  **ABOVE 80% threshold**"
  fi
else
  echo "- error fetching billing (gh api permission?)"
fi
echo ""

# --- Sentry ---
echo "## Sentry"
if [ -n "${SENTRY_ORG_TOKEN:-}" ]; then
  SENTRY_ORG="${SENTRY_ORG:-tom}"
  STATS=$(curl -sS -H "Authorization: Bearer $SENTRY_ORG_TOKEN" \
    "https://sentry.io/api/0/organizations/$SENTRY_ORG/stats_v2/?statsPeriod=30d&field=sum(quantity)&groupBy=category" || echo '{}')
  ERRORS=$(echo "$STATS" | jq -r '.groups[]? | select(.by.category=="error") | .totals["sum(quantity)"] // 0')
  echo "- Errors this month: **${ERRORS:-0}** / 5000"
else
  echo "- SENTRY_ORG_TOKEN not set, skipped"
fi
echo ""

# --- PostHog ---
echo "## PostHog"
if [ -n "${POSTHOG_PERSONAL_API_KEY:-}" ] && [ -n "${POSTHOG_PROJECT_ID:-}" ]; then
  USAGE=$(curl -sS -H "Authorization: Bearer $POSTHOG_PERSONAL_API_KEY" \
    "https://eu.i.posthog.com/api/projects/$POSTHOG_PROJECT_ID/usage/" || echo '{}')
  EVENTS=$(echo "$USAGE" | jq -r '.event_count_in_period // 0')
  echo "- Events this month: **${EVENTS:-0}** / 1,000,000"
else
  echo "- POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID not set, skipped"
fi
echo ""

# --- Supabase ---
echo "## Supabase (staging)"
echo "- Manual check required : https://supabase.com/dashboard/project/<staging>/database/usage"
echo "- DB size target: <400 MB (80% of 500 MB)"
echo ""

# --- EAS ---
echo "## EAS builds"
if [ -n "${EXPO_TOKEN:-}" ]; then
  ACCOUNT=$(npx eas whoami --non-interactive --json 2>/dev/null | jq -r '.accounts[0].name // empty')
  if [ -n "$ACCOUNT" ]; then
    BUILDS=$(curl -sS -H "Authorization: Bearer $EXPO_TOKEN" \
      "https://api.expo.dev/v2/accounts/$ACCOUNT/builds?limit=100" || echo '{}')
    MONTH=$(date -u +%Y-%m)
    COUNT=$(echo "$BUILDS" | jq -r "[.data[]? | select(.createdAt | startswith(\"$MONTH\"))] | length")
    echo "- Builds this month: **${COUNT:-0}** / 30 (combined platforms)"
  else
    echo "- could not resolve EAS account, skipped"
  fi
else
  echo "- EXPO_TOKEN not set, skipped"
fi
echo ""

echo "---"
echo "Regenerate: \`bash scripts/check-quotas.sh\`"
echo "Thresholds documented in \`docs/metrics/quotas.md\`."
