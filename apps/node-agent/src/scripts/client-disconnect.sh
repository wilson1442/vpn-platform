#!/bin/bash
# OpenVPN client-disconnect script
# Called by OpenVPN when a client disconnects.
#
# OpenVPN sets these environment variables:
#   common_name    - certificate CN of the disconnecting client
#   bytes_received - total bytes received from client
#   bytes_sent     - total bytes sent to client
#   time_duration  - connection duration in seconds
#
# Usage in server.conf:
#   script-security 2
#   client-disconnect /etc/openvpn/scripts/client-disconnect.sh
#
# Required environment variables (set in systemd unit or wrapper):
#   AGENT_URL    - node-agent base URL (default: http://127.0.0.1:3001)
#   AGENT_TOKEN  - agent auth token matching the VPN node registration

AGENT_URL="${AGENT_URL:-http://127.0.0.1:3001}"
AGENT_TOKEN="${AGENT_TOKEN:-}"
LOG_TAG="openvpn-disconnect"

log() { logger -t "$LOG_TAG" "$@"; }

if [ -z "$AGENT_TOKEN" ]; then
  log "ERROR: AGENT_TOKEN not set"
  exit 0  # Don't block disconnect on config error
fi

CN="${common_name:-}"
BYTES_IN="${bytes_received:-0}"
BYTES_OUT="${bytes_sent:-0}"

if [ -z "$CN" ]; then
  log "ERROR: common_name not set by OpenVPN"
  exit 0  # Don't block disconnect
fi

log "Disconnect: CN=${CN} rx=${BYTES_IN} tx=${BYTES_OUT}"

curl -s \
  --max-time 10 \
  --retry 2 \
  --retry-max-time 10 \
  -X POST "${AGENT_URL}/disconnect-proxy" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${AGENT_TOKEN}" \
  -d "{\"commonName\": \"${CN}\", \"bytesReceived\": ${BYTES_IN}, \"bytesSent\": ${BYTES_OUT}}" \
  > /dev/null 2>&1

# Always exit 0 — never block a disconnect
exit 0
