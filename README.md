# Early Chinese Coin Finds Database

A searchable, mapped record of pre-Qin to early Han coin discoveries across China — archaeological sites, excavation contexts, individual finds, coin typology, mint towns, and museum specimens, presented in both English and Chinese.

Live pieces at a glance:

- **Search** every recorded find site by region, period, site type, coin type, state, mint, or quantity.
- **Map Visualizations** for Find Site and Mint Town data, each with Points / Density / Compare display modes.
- A full **Coin Types** typology browser (钱币/Coin and 钱范/Mould hierarchies) and a **Mints** directory of coin-producing towns.
- **Museum Collections** — reconciled ANS (American Numismatic Society) specimens shown the same way as the database's own mint data.

## Getting started

This project requires **Node ≥ 20** (a system default of Node 18 via `nvm` cannot run `next dev` on Next.js 16 — switch versions first, e.g. `nvm use 20`).

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required environment variables (`.env.local`):

- `DATABASE_URL` — MySQL connection, e.g. `mysql://root@127.0.0.1:3306/early_china_coinage` for the local `docker compose up` copy
- `BETTER_AUTH_SECRET` (production) — random secret for signing sessions, e.g. `openssl rand -base64 32`
- `BETTER_AUTH_URL` (production) — the site's public origin, e.g. `https://example.org`
- `ADMIN_EMAILS` — comma-separated emails allowed to edit
- `AUDIT_LOG_PATH` (optional) — where deleted rows are logged (default `logs/deletions.log`); in production, keep it outside the deployed build directory

Editors sign in at `/login`. Sign-up is disabled, so to set up auth:

1. Create the auth tables once: `mysql -u <user> -p <database> < scripts/better-auth-schema.sql`.
2. Create each account, or reset its password. It prompts for the password, and a reset also signs out that account's sessions: `node --env-file=.env.local scripts/create-user.mjs <email>`.
3. Add the email to `ADMIN_EMAILS`.

Every delete made through the edit UI is appended to the deletion log as one JSON line per row (every column), including rows removed by cascade (a context's finds and coin items), so they can be restored by hand.

Other scripts: `npm run build`, `npm run start`, `npm run lint`.

## Documentation

| Doc | What it covers |
|---|---|
| [`docs/DATA_VISUALIZATION_CALCULATIONS.md`](docs/DATA_VISUALIZATION_CALCULATIONS.md) | The exact math behind every map's point size and color (Points/Density/Compare modes) — the "what number produces what pixel" reference. |


## Stack

Next.js 16 (App Router) + React 19 + TypeScript, Tailwind CSS 4, MySQL (via Drizzle ORM) as the one datastore, Better Auth for editor sign-in, and Leaflet for every interactive map. No separate backend or API layer — server components query MySQL directly at render time.

## Data


- **MySQL**: anything about a specific archaeological find, coin issue, or museum specimen — queried through `lib/queries.ts` and `lib/ans-museum-data.ts`.
- **Local (bundled in the repo)**: reference/gazetteer data that rarely changes (river overlays, specimen photography) — used as a fallback or supplement wherever the database doesn't carry a field yet. 

## Deployment

Production is one Ubuntu server: MySQL, the app as a systemd service, and Apache in front with HTTPS. [`scripts/setup-ec2.sh`](scripts/setup-ec2.sh) sets up a fresh server, and [`scripts/deploy-ec2.sh`](scripts/deploy-ec2.sh) redeploys. The Apache config is [`scripts/apache/coin-app.conf.template`](scripts/apache/coin-app.conf.template).

**Testing it locally.** [`docker-compose.prod.yml`](docker-compose.prod.yml) runs the same setup in Docker, using the same Apache config, a limited MySQL user and no exposed app or MySQL ports:

```bash
cp docker/prod.env.example .env.prod   # fill in the secrets
docker compose -f docker-compose.prod.yml --env-file .env.prod up --build
docker compose -f docker-compose.prod.yml --env-file .env.prod exec app node scripts/create-user.mjs you@example.com
```

Then open https://localhost and accept the self-signed certificate warning.

**No domain name?** Pass the server's public IP to `setup-ec2.sh`. It uses `<ip-with-dashes>.sslip.io` (e.g. `3-91-20-7.sslip.io`), a free hostname that resolves to that IP, and gets a real Let's Encrypt certificate for it. A domain can replace it later; rerun the certificate and Apache steps with the new name.

**Security checklist for any production server** (`setup-ec2.sh` does all of this; check it by hand on a server set up another way):

- The app connects to MySQL as a user with only `SELECT, INSERT, UPDATE, DELETE` on this database, never root.
- MySQL listens on `127.0.0.1` only. The app listens on `127.0.0.1` only (`HOSTNAME=127.0.0.1`). The firewall/Security Group allows only 22, 80 and 443.
- Apache serves HTTPS, redirects HTTP to it, and has `RequestHeader unset X-Forwarded-For early` (without that line, the login rate limit can be bypassed).
- `BETTER_AUTH_SECRET` is random and set only in `.env.production` (mode 600), and `BETTER_AUTH_URL` is the `https://` address.
- `AUDIT_LOG_PATH` points outside the build directory, which redeploys replace.
