#!/usr/bin/env bash
# restart-dev.sh — Kill all stale dev processes and restart API + Web cleanly.
# Usage: bash /opt/vpn/restart-dev.sh

set -e

echo "==> Stopping all API dev processes..."
pkill -f 'pnpm --filter api dev' 2>/dev/null || true
pkill -f 'nest start --watch' 2>/dev/null || true
pkill -f 'node --enable-source-maps /opt/vpn/apps/api/dist/main' 2>/dev/null || true

echo "==> Stopping all Web dev processes..."
pkill -f 'next dev -p 3100' 2>/dev/null || true
pkill -f 'next-server' 2>/dev/null || true

# Wait for ports to free up
sleep 2

# Force-kill anything still on ports 3000/3100
lsof -ti:3000 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3100 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

echo "==> Building API..."
cd /opt/vpn
pnpm --filter api build 2>&1 | tail -3

echo "==> Starting API (nest start --watch)..."
nohup pnpm --filter api dev > /tmp/api-dev.log 2>&1 &
API_PID=$!

echo "==> Waiting for API on port 3000..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' http://localhost:3000/settings/public 2>/dev/null; then
    echo "    API is up (pid $API_PID)"
    break
  fi
  sleep 1
done

echo "==> Starting Web (next dev -p 3100)..."
cd /opt/vpn/apps/web
nohup npx next dev -p 3100 > /tmp/next-dev.log 2>&1 &
WEB_PID=$!

echo "==> Waiting for Web on port 3100..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null -w '' http://localhost:3100 2>/dev/null; then
    echo "    Web is up (pid $WEB_PID)"
    break
  fi
  sleep 1
done

echo ""
echo "==> Done! Services running:"
echo "    API: http://localhost:3000  (log: /tmp/api-dev.log)"
echo "    Web: http://localhost:3100  (log: /tmp/next-dev.log)"
