#!/bin/bash
# OpenVPN auth-user-pass-verify script (via-file mode)
#
# OpenVPN passes the path to a temp file as $1 containing:
#   line 1: username
#   line 2: password
#
# Required environment variables (set in systemd override):
#   AGENT_URL    - node-agent base URL (default: http://127.0.0.1:3001)
#   AGENT_TOKEN  - agent auth token

set -euo pipefail

AGENT_URL="${AGENT_URL:-http://127.0.0.1:3001}"
AGENT_TOKEN="${AGENT_TOKEN:-}"
LOG_TAG="openvpn-auth"

log() { logger -t "$LOG_TAG" "$@"; }

if [ -z "$AGENT_TOKEN" ]; then
  log "ERROR: AGENT_TOKEN not set"
  exit 1
fi

CRED_FILE="${1:-}"
if [ -z "$CRED_FILE" ] || [ ! -f "$CRED_FILE" ]; then
  log "ERROR: credentials file not provided or missing"
  exit 1
fi

USERNAME=$(sed -n '1p' "$CRED_FILE")
PASSWORD=$(sed -n '2p' "$CRED_FILE")

if [ -z "$USERNAME" ] || [ -z "$PASSWORD" ]; then
  log "ERROR: empty username or password"
  exit 1
fi

log "Auth request for user: ${USERNAME}"

# JSON-escape the password (handle special chars)
JSON_PAYLOAD=$(printf '{"username":"%s","password":"%s"}' \
  "$(echo -n "$USERNAME" | sed 's/\\/\\\\/g; s/"/\\"/g')" \
  "$(echo -n "$PASSWORD" | sed 's/\\/\\\\/g; s/"/\\"/g')")

response=$(curl -s -w "\n%{http_code}" \
  --max-time 10 \
  --retry 1 \
  --retry-max-time 5 \
  -X POST "${AGENT_URL}/auth-verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -d "$JSON_PAYLOAD" 2>&1)

http_body=$(echo "$response" | sed '$d')
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
  log "Auth SUCCESS: user=${USERNAME} (HTTP ${http_code})"
  exit 0
else
  log "Auth DENIED: user=${USERNAME} (HTTP ${http_code}) ${http_body}"
  exit 1
fi
