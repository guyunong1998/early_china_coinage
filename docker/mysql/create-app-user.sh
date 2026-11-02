#!/bin/bash
# Docker init step (docker-compose.prod.yml): the app's own MySQL login, able
# to read and write rows in this one database and nothing else — no DDL, no
# GRANT, no other databases. Mirrors the user scripts/setup-ec2.sh creates.
set -euo pipefail
if [[ ! "$APP_DB_PASSWORD" =~ ^[A-Za-z0-9]{20,}$ ]]; then
  echo "APP_DB_PASSWORD must be 20+ letters/digits (it goes into DATABASE_URL); use: openssl rand -hex 24" >&2
  exit 1
fi
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE USER 'coinapp'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO 'coinapp'@'%';
SQL
