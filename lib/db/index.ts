import 'server-only'
import { drizzle } from 'drizzle-orm/mysql2'
import { createPool, type Pool } from 'mysql2/promise'
import * as schema from '@/lib/db/schema'

/**
 * Two MySQL connection pools, so a flaw in a public read path can't write:
 *
 * - `db` / `pool` (DATABASE_URL): the read/write user. lib/admin/*'s writes
 *   and Better Auth's user/session tables (lib/auth/auth.ts) use it. MySQL has
 *   no row-level security, so nothing at the database layer stops a write
 *   from it — every Server Action must call assertAuthorized()
 *   (lib/admin/guard.ts) first.
 * - `readDb` (DATABASE_URL_READONLY): a user granted SELECT only, for every
 *   page's reads (lib/queries.ts and the other read-only helpers). Required:
 *   there is deliberately no fallback to the read/write user, so a missing
 *   variable fails loudly instead of quietly running reads with write access.
 *
 * Both are mysql:// URIs, e.g.
 * mysql://user:password@127.0.0.1:3306/early_china_coinage
 * `timezone: 'Z'` keeps Better Auth's Date values in UTC, matching how the
 * migrated created_at columns were written. The connection collation is
 * MySQL 8's server default rather than mysql2's utf8mb4_unicode_ci: views
 * like v_source_link_targets build columns from string literals, which take
 * the server default, and comparing them to a unicode_ci parameter fails
 * with "Illegal mix of collations". Cached on globalThis so dev-mode HMR
 * doesn't open a new pool per reload.
 *
 * A write followed by a read of the same row (e.g. createFind then
 * getFindById) assumes both users reach the same primary server, not a lagging replica.
 */
const globalForDb = globalThis as unknown as { mysqlPool?: Pool; mysqlReadPool?: Pool }

function createAppPool(envVar: string): Pool {
  const uri = process.env[envVar]?.trim()
  if (!uri) throw new Error(`Missing ${envVar} in .env.local (mysql://user:password@host:3306/database).`)
  return createPool({ uri, connectionLimit: 5, timezone: 'Z', charset: 'UTF8MB4_0900_AI_CI' })
}

function getPool() {
  return (globalForDb.mysqlPool ??= createAppPool('DATABASE_URL'))
}

function getReadPool() {
  return (globalForDb.mysqlReadPool ??= createAppPool('DATABASE_URL_READONLY'))
}

export const pool = getPool()
export const db = drizzle({ client: pool, schema, mode: 'default' })
export const readDb = drizzle({ client: getReadPool(), schema, mode: 'default' })
export type Db = typeof db
