#!/usr/bin/env bash
# Register (or update) the Cloudflare Stream webhook for this app.
#
# Prerequisites:
#   - .env.local with CLOUDFLARE_STREAM_API_TOKEN and CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID)
#   - A public HTTPS notification URL (not localhost)
#
# Usage:
#   ./scripts/register-stream-webhook.sh
#   ./scripts/register-stream-webhook.sh https://fanbase.ng
#   NOTIFICATION_URL=https://my-app.vercel.app ./scripts/register-stream-webhook.sh
#
# After success, copy result.secret into .env.local / Vercel as:
#   MEDIA_WEBHOOK_SECRET=<secret from API response>
# The app verifies Cloudflare's Webhook-Signature HMAC with this secret.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -f .env.local ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env.local
  set +a
fi

ACCOUNT_ID="${CLOUDFLARE_ACCOUNT_ID:-${R2_ACCOUNT_ID:-}}"
TOKEN="${CLOUDFLARE_STREAM_API_TOKEN:-}"

if [[ -z "$ACCOUNT_ID" || -z "$TOKEN" ]]; then
  echo "Missing CLOUDFLARE_ACCOUNT_ID (or R2_ACCOUNT_ID) or CLOUDFLARE_STREAM_API_TOKEN in .env.local" >&2
  exit 1
fi

BASE_URL="${1:-${NOTIFICATION_URL:-${NEXT_PUBLIC_APP_URL:-}}}"
if [[ -z "$BASE_URL" ]]; then
  echo "Usage: $0 <https://your-public-app-url>" >&2
  exit 1
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

if [[ "$BASE_URL" == *"localhost"* || "$BASE_URL" == *"127.0.0.1"* ]]; then
  echo "Error: Cloudflare Stream cannot send webhooks to localhost." >&2
  echo "Use your Vercel/production URL or a tunnel (ngrok, cloudflared)." >&2
  exit 1
fi

if [[ "$BASE_URL" != https://* ]]; then
  echo "Warning: Cloudflare recommends HTTPS for notificationUrl." >&2
fi

WEBHOOK_URL="${BASE_URL}/api/v1/media/webhooks/stream"

echo "Registering Stream webhook:"
echo "  account: ${ACCOUNT_ID}"
echo "  url:     ${WEBHOOK_URL}"
echo ""

RESPONSE="$(curl -sS -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/stream/webhook" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  --data "{\"notificationUrl\":\"${WEBHOOK_URL}\"}")"

if command -v node >/dev/null 2>&1; then
  echo "$RESPONSE" | node -e "
    const j = JSON.parse(require('fs').readFileSync(0, 'utf8'));
    if (!j.success) {
      console.error('Failed:', JSON.stringify(j.errors ?? j, null, 2));
      process.exit(1);
    }
    const r = j.result ?? {};
    console.log('Success.');
    console.log('  notificationUrl:', r.notificationUrl ?? r.notification_url);
    console.log('  modified:', r.modified);
    if (r.secret) {
      console.log('');
      console.log('Add to .env.local and Vercel (Production):');
      console.log('  MEDIA_WEBHOOK_SECRET=' + r.secret);
      console.log('');
      console.log('Keep this secret private. Cloudflare signs webhooks with Webhook-Signature (HMAC-SHA256).');
    }
  "
else
  echo "$RESPONSE"
fi
