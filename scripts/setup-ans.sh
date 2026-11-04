#!/usr/bin/env bash
set -euo pipefail

# One-time setup of the app on the ANS server (numismatics.org). A reference
# more than a script: you'll usually paste these lines in one at a time.
#
# How this differs from setup-full.sh (a blank EC2 box):
#   - The database is the RDS instance, so no MySQL is installed or created.
#   - Apache and HTTPS are run by ANS, so no Apache, certbot or certificate.
#   - The server has plenty of memory and disk, so no swap file and no
#     Node heap limit.
#   - Files live under /usr/local/projects/chec, not in $HOME.
#
# Needs already installed: git, Node 20+, npm, curl, sudo. Check with:
#   node -v
#
# Before running, in the RDS database (as its owner, once):
#   - load the data:        pg_export/mysql_dump.sql      (not in git; scp it up)
#   - load the auth tables: scripts/better-auth-schema.sql
#   - have two logins: one read/write (SELECT, INSERT, UPDATE, DELETE) and one
#     read-only (SELECT), both on this database only.
#
# NOT in git, so a pull never brings or changes them (recreate by hand):
#   - .env.production        written below; holds every secret
#   - /etc/systemd/system/coin-app.service    written below
#   - the Apache proxy for chec.numismatics.org (ANS runs Apache)
#   - pg_export/mysql_dump.sql

SERVER_NAME=chec.numismatics.org
PROJECT_DIR=/usr/local/projects/chec
APP_DIR=$PROJECT_DIR/early_china_coinage_aws   # the git checkout
RUN_DIR=$PROJECT_DIR/standalone                # the built server the service runs
LOG_DIR=$PROJECT_DIR/logs
SERVICE_USER=$USER                             # CHECK: the account the service should run as
PORT=3000                                      # CHECK: free on this server? (ss -ltn | grep 3000)

echo "== Folders and code =="
sudo mkdir -p "$APP_DIR" "$LOG_DIR"
sudo chown "$USER" "$APP_DIR"
sudo chown "$SERVICE_USER" "$LOG_DIR"
git clone https://github.com/anonymousanemone/early_china_coinage_aws.git "$APP_DIR"
cd "$APP_DIR"

echo "== .env.production =="
# Every variable the app reads in production. Fill in the CHANGE_ME values.
#
# DATABASE_URL            read/write login: edits and sign-in.
# DATABASE_URL_READONLY   read-only login: every page's reads. Required, and
#                         it must be a different login from the one above.
#                         URL-encode special characters in a password that
#                         are @ / : # ? (for example @ becomes %40).
# BETTER_AUTH_SECRET      signs login sessions; generated here, never typed.
# BETTER_AUTH_URL         the site's public address, https.
# ADMIN_EMAILS            only these signed-in accounts can edit. Accounts are
#                         created with scripts/create-user.mjs (see the end).
# AUDIT_LOG_PATH          where rows deleted through the edit UI are logged;
#                         keep it outside the build folders.
# PORT                    the app listens on 127.0.0.1:PORT only; Apache
#                         proxies to it.
# NEXT_PUBLIC_*           baked into the pages when they are BUILT, so changing
#                         them needs a rebuild (redeploy-ans.sh), not just a restart.
#                         MAPBOX_TOKEN is optional: without it the Mapbox map
#                         layer is not offered.
( umask 077 && cat > .env.production <<EOF
DATABASE_URL=mysql://CHANGE_ME_RW_USER:CHANGE_ME_PASSWORD@CHANGE_ME_RDS_HOST:3306/CHANGE_ME_DATABASE
DATABASE_URL_READONLY=mysql://CHANGE_ME_RO_USER:CHANGE_ME_PASSWORD@CHANGE_ME_RDS_HOST:3306/CHANGE_ME_DATABASE
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://$SERVER_NAME
ADMIN_EMAILS=CHANGE_ME@example.com,CHANGE_ME_TOO@example.com
AUDIT_LOG_PATH=$LOG_DIR/deletions.log
PORT=$PORT
NEXT_PUBLIC_SITE_URL=https://$SERVER_NAME
NEXT_PUBLIC_MAPBOX_TOKEN=
EOF
)
${EDITOR:-nano} .env.production     # fill in the CHANGE_ME values, then save

echo "== Install, check the database, build =="
npm ci
# Read-only check of each login (prints row counts). The build also reads the
# database, so find out now if a login or the RDS firewall is wrong.
for var in DATABASE_URL_READONLY DATABASE_URL; do
  DATABASE_URL="$(grep "^$var=" .env.production | cut -d= -f2-)" node scripts/check-counts.mjs
done
npm run build        # reads .env.production by itself

echo "== Put the build in place =="
STANDALONE_DIR=$(dirname "$(find .next/standalone -name server.js -not -path '*/node_modules/*' | head -1)")
cp -r public "$STANDALONE_DIR/"
cp -r .next/static "$STANDALONE_DIR/.next/"
sudo cp -r "$STANDALONE_DIR" "$RUN_DIR"

echo "== systemd service =="
# HOSTNAME=127.0.0.1: only Apache on this machine can reach the app, not the
# network. The unit reads the same .env.production.
sudo tee /etc/systemd/system/coin-app.service > /dev/null <<EOF
[Unit]
Description=Early China Coinage Next.js app
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
WorkingDirectory=$RUN_DIR
EnvironmentFile=$APP_DIR/.env.production
Environment=PORT=$PORT
Environment=HOSTNAME=127.0.0.1
ExecStart=$(command -v node) server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now coin-app
sudo systemctl status coin-app --no-pager
curl -I http://127.0.0.1:$PORT/     # expect HTTP 200

echo "== Still to do by hand =="
# 1. Apache: ask whoever runs it for numismatics.org to proxy
#    https://$SERVER_NAME to http://127.0.0.1:$PORT/ with these two lines
#    (the first is needed: the login rate limit trusts that header):
#        RequestHeader unset X-Forwarded-For early
#        RequestHeader set X-Forwarded-Proto "https"
#    A complete example: scripts/apache/coin-app.conf.template
#
# 2. Create each editor's login (prompts for a password; the email must also
#    be in ADMIN_EMAILS):
#        cd $APP_DIR && node --env-file=.env.production scripts/create-user.mjs <email>
#
# 3. Later updates: scripts/redeploy-ans.sh
