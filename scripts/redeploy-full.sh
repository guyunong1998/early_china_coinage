#!/usr/bin/env bash
set -euo pipefail

# Redeploys the app on the blank-EC2 setup (setup-full.sh): pull the latest
# code from GitHub, rebuild and restart the service. A reference more than a
# script: paste the lines you need. After changing only .env.production, skip
# to "Rebuild" (NEXT_PUBLIC_* values are baked in at build time) or just run
# the restart line.
#
# Not in git, so a pull never changes them: .env.production, the systemd
# unit and the Apache site. For the ANS server use redeploy-ans.sh.

APP_DIR="$HOME/early_china_coinage_aws"

echo "== Pull latest =="
cd "$APP_DIR"
git pull --ff-only origin main

echo "== Rebuild =="
npm ci
# 896MB cap: the box is small and would otherwise run out of memory.
NODE_OPTIONS="--max-old-space-size=896" npm run build    # reads .env.production by itself

echo "== Put the build in place =="
# The service runs straight from this folder, so no copying elsewhere.
STANDALONE_DIR=$(dirname "$(find .next/standalone -name server.js -not -path '*/node_modules/*' | head -1)")
cp -r public "$STANDALONE_DIR/"
cp -r .next/static "$STANDALONE_DIR/.next/"

echo "== Restart =="
sudo systemctl restart coin-app
sudo systemctl status coin-app --no-pager
curl -I http://127.0.0.1:3000/     # expect HTTP 200
# If it fails: sudo journalctl -u coin-app -n 50 --no-pager
