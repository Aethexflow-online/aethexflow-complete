#!/usr/bin/env bash
# AethexFlow Edge — one-command deploy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/workers/aethexflow-edge"

echo "==> Deploying aethexflow-edge"
npx wrangler deploy

echo ""
echo "==> Done. Test:"
echo "    curl -sS https://aethexflow-edge.\$(wrangler whoami 2>/dev/null | head -1 | awk '{print \$NF}' || echo YOUR_ACCOUNT).workers.dev/api/health"
echo ""
echo "Required for Admin Gateway:"
echo "    npx wrangler secret put ADMIN_OWNER_KEY"
echo "Optional external AI fallback:"
echo "    npx wrangler secret put GEMINI_API_KEY"
