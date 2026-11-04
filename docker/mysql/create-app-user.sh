#!/bin/bash
# Docker init step (docker-compose.prod.yml): the app's own MySQL logins — one
# able to read and write rows in this one database, one that can only read —
# and nothing else: no DDL, no GRANT, no other databases. Mirrors the users
# scripts/setup-full.sh creates.
set -euo pipefail
for var in APP_DB_PASSWORD APP_RO_DB_PASSWORD; do
  if [[ ! "${!var}" =~ ^[A-Za-z0-9]{20,}$ ]]; then
    echo "$var must be 20+ letters/digits (it goes into a DATABASE_URL); use: openssl rand -hex 24" >&2
    exit 1
  fi
done
mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE USER 'coinapp'@'%' IDENTIFIED BY '${APP_DB_PASSWORD}';
GRANT SELECT, INSERT, UPDATE, DELETE ON \`${MYSQL_DATABASE}\`.* TO 'coinapp'@'%';
CREATE USER 'coinapp_ro'@'%' IDENTIFIED BY '${APP_RO_DB_PASSWORD}';
GRANT SELECT ON \`${MYSQL_DATABASE}\`.* TO 'coinapp_ro'@'%';
SQL
