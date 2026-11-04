#!/usr/bin/env bash
set -euo pipefail

# One-time setup of a blank Ubuntu server (e.g. a small EC2 instance): MySQL,
# the app (systemd), Apache with HTTPS, all on the one machine.
# docker-compose.prod.yml is a local copy of this same setup. A reference more
# than a script: you can paste the lines in one at a time. For the ANS server
# (database on RDS, Apache run by ANS) use setup-ans.sh instead.
#
#   ./setup-full.sh <public-ip-or-domain> [path/to/mysql_dump.sql]
#
# Because the box is small, it gets a 2GB swap file and the build is capped
# at 896MB of Node memory so it doesn't run out of RAM; the ANS server needs
# neither.
#
# NOT in git, so a pull never brings or changes them (recreate by hand):
#   .env.production, the systemd unit, the Apache site, the MySQL logins and
#   the dump (pg_export/mysql_dump.sql).
#
# Without a domain, pass the server's public IP: it's turned into an
# <ip-with-dashes>.sslip.io hostname (sslip.io resolves it back to the IP),
# which Let's Encrypt will issue a real certificate for.
# Before running: the Security Group must allow 22 (SSH), 80 and 443 — and
# nothing else. The dump (pg_export/mysql_dump.sql, not in git) can be copied
# up first with scp; without it the database starts empty.

REPO_URL="https://github.com/anonymousanemone/early_china_coinage_aws.git"
APP_DIR="$HOME/early_china_coinage_aws"
TARGET="${1:?Usage: $0 <public-ip-or-domain> [path/to/mysql_dump.sql]}"
DUMP="${2:-}"
DB_NAME=early_china_coinage

if [[ "$TARGET" =~ ^[0-9]+(\.[0-9]+){3}$ ]]; then
  SERVER_NAME="${TARGET//./-}.sslip.io"
else
  SERVER_NAME="$TARGET"
fi
echo "Site will be https://$SERVER_NAME"

echo "== System packages =="
sudo apt update && sudo apt upgrade -y
sudo apt install -y apache2 mysql-server certbot gettext-base git curl build-essential cloud-guest-utils

echo "== Node 22 =="
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v

echo "== 2GB swap (skip if already present) =="
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi
free -h

echo "== Clone app =="
git clone "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

echo "== MySQL =="
# Ubuntu's MySQL listens on 127.0.0.1 only and root logs in via `sudo mysql`
# (no password, local only) — check the former rather than assume it.
if ! sudo grep -Eq '^\s*bind-address\s*=\s*127\.0\.0\.1' /etc/mysql/mysql.conf.d/mysqld.cnf; then
  echo "MySQL is not bound to 127.0.0.1 — fix bind-address in /etc/mysql/mysql.conf.d/mysqld.cnf first." >&2
  exit 1
fi
sudo mysql -e "CREATE DATABASE $DB_NAME"
if [[ -n "$DUMP" ]]; then
  sudo mysql "$DB_NAME" < "$DUMP"
else
  echo "No dump given — load it later with: sudo mysql $DB_NAME < mysql_dump.sql"
fi
sudo mysql "$DB_NAME" < scripts/better-auth-schema.sql

# The app's own logins: one that reads/writes rows in this one database, and
# one that can only read (used for every page's reads), nothing else.
APP_DB_PASSWORD=$(openssl rand -hex 24)
APP_RO_DB_PASSWORD=$(openssl rand -hex 24)
sudo mysql <<SQL
CREATE USER 'coinapp'@'localhost' IDENTIFIED BY '$APP_DB_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`$DB_NAME\`.* TO 'coinapp'@'localhost';
CREATE USER 'coinapp_ro'@'localhost' IDENTIFIED BY '$APP_RO_DB_PASSWORD';
GRANT SELECT ON \`$DB_NAME\`.* TO 'coinapp_ro'@'localhost';
SQL

echo "== App settings (.env.production) =="
# Every variable the app reads in production:
# DATABASE_URL            read/write login: edits and sign-in.
# DATABASE_URL_READONLY   read-only login: every page's reads. Required.
# BETTER_AUTH_SECRET      signs login sessions; generated, never typed.
# BETTER_AUTH_URL         the site's public address, https.
# ADMIN_EMAILS            only these signed-in accounts can edit.
# AUDIT_LOG_PATH          where rows deleted through the edit UI are logged.
# NEXT_PUBLIC_*           baked into the pages at BUILD time, so changing them
#                         needs a rebuild (redeploy-full.sh). MAPBOX_TOKEN is
#                         optional: without it the Mapbox map layer is not offered.
read -r -p "Admin email(s), comma-separated: " ADMIN_EMAILS
mkdir -p "$APP_DIR/logs"
# Generated here so the secrets are never typed or pasted anywhere.
( umask 077 && cat > .env.production <<EOF
DATABASE_URL=mysql://coinapp:$APP_DB_PASSWORD@127.0.0.1:3306/$DB_NAME
DATABASE_URL_READONLY=mysql://coinapp_ro:$APP_RO_DB_PASSWORD@127.0.0.1:3306/$DB_NAME
BETTER_AUTH_SECRET=$(openssl rand -base64 32)
BETTER_AUTH_URL=https://$SERVER_NAME
ADMIN_EMAILS=$ADMIN_EMAILS
AUDIT_LOG_PATH=$APP_DIR/logs/deletions.log
NEXT_PUBLIC_SITE_URL=https://$SERVER_NAME
NEXT_PUBLIC_MAPBOX_TOKEN=
EOF
)

echo "== Install + build =="
npm ci
NODE_OPTIONS="--max-old-space-size=896" npm run build

STANDALONE_DIR=$(dirname "$(find .next/standalone -name server.js -not -path '*/node_modules/*' | head -1)")
echo "Standalone server at: $STANDALONE_DIR"

cp -r public "$STANDALONE_DIR/"
cp -r .next/static "$STANDALONE_DIR/.next/"

echo "== systemd service =="
# HOSTNAME=127.0.0.1: the app only accepts connections from Apache on this
# machine, never directly from the internet.
sudo tee /etc/systemd/system/coin-app.service > /dev/null <<EOF
[Unit]
Description=Early China Coinage Next.js app
After=network.target mysql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$STANDALONE_DIR
EnvironmentFile=$APP_DIR/.env.production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=$(which node) server.js
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable coin-app
sudo systemctl start coin-app
sudo systemctl status coin-app --no-pager

echo "== HTTPS certificate (Let's Encrypt) =="
# Apache's stock site serves /var/www/html on port 80, which is all the
# webroot challenge needs; renewals reuse the same path (see the template's
# port-80 vhost), and the deploy hook reloads Apache with the new certificate.
sudo certbot certonly --webroot -w /var/www/html -d "$SERVER_NAME" \
  --agree-tos --register-unsafely-without-email --non-interactive \
  --deploy-hook "systemctl reload apache2"

echo "== Apache reverse proxy =="
sudo a2enmod ssl proxy proxy_http headers rewrite
SERVER_NAME="$SERVER_NAME" APP_UPSTREAM=127.0.0.1:3000 \
  SSL_CERT="/etc/letsencrypt/live/$SERVER_NAME/fullchain.pem" \
  SSL_KEY="/etc/letsencrypt/live/$SERVER_NAME/privkey.pem" \
  envsubst '${SERVER_NAME} ${APP_UPSTREAM} ${SSL_CERT} ${SSL_KEY}' < scripts/apache/coin-app.conf.template \
  | sudo tee /etc/apache2/sites-available/coin-app.conf > /dev/null

sudo a2ensite coin-app.conf
sudo a2dissite 000-default.conf
sudo apache2ctl configtest
sudo systemctl reload apache2

echo "== Done =="
echo "Create each editor's login (prompts for the password):"
echo "  cd $APP_DIR && node --env-file=.env.production scripts/create-user.mjs <email>"
echo "Then visit https://$SERVER_NAME"
