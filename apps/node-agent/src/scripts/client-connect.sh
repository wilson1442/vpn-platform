#!/bin/bash
# OpenVPN client-connect script
# Called by OpenVPN when a client connects.
#
# OpenVPN sets these environment variables:
#   common_name    - certificate CN of the connecting client
#   trusted_ip     - client's real IP address
#   trusted_port   - client's source port
#   ifconfig_pool_remote_ip - assigned VPN IP (if applicable)
#
# Usage in server.conf:
#   script-security 2
#   client-connect /etc/openvpn/scripts/client-connect.sh
#
# Required environment variables (set in systemd unit or wrapper):
#   AGENT_URL    - node-agent base URL (default: http://127.0.0.1:3001)
#   AGENT_TOKEN  - agent auth token matching the VPN node registration

set -euo pipefail

AGENT_URL="${AGENT_URL:-http://127.0.0.1:3001}"
AGENT_TOKEN="${AGENT_TOKEN:-}"
LOG_TAG="openvpn-connect"

log() { logger -t "$LOG_TAG" "$@"; }

if [ -z "$AGENT_TOKEN" ]; then
  log "ERROR: AGENT_TOKEN not set"
  exit 1
fi

CN="${common_name:-}"
REAL_ADDR="${trusted_ip:-unknown}:${trusted_port:-0}"

if [ -z "$CN" ]; then
  log "ERROR: common_name not set by OpenVPN"
  exit 1
fi

log "Connect request: CN=${CN} from ${REAL_ADDR}"

response=$(curl -s -w "\n%{http_code}" \
  --max-time 10 \
  --retry 1 \
  --retry-max-time 5 \
  -X POST "${AGENT_URL}/connect-proxy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -d "{\"commonName\": \"${CN}\", \"realAddress\": \"${REAL_ADDR}\"}" 2>&1)

http_body=$(echo "$response" | sed '$d')
http_code=$(echo "$response" | tail -n1)

if [ "$http_code" -eq 200 ] || [ "$http_code" -eq 201 ]; then
  log "Connect allowed: CN=${CN} (HTTP ${http_code})"
  exit 0
else
  log "Connect DENIED: CN=${CN} (HTTP ${http_code}) ${http_body}"
  exit 1
fi
