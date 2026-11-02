import 'server-only'
import { drizzle } from 'drizzle-orm/mysql2'
import { createPool, type Pool } from 'mysql2/promise'
import * as schema from '@/lib/db/schema'

/**
 * The one MySQL connection pool for the whole app: lib/queries.ts's reads,
 * lib/admin/*'s writes, and Better Auth's user/session tables (lib/auth/auth.ts)
 * all share it. MySQL has no row-level security, so nothing at the database
 * layer stops a write — every Server Action must call assertAuthorized()
 * (lib/admin/guard.ts) first, and the DATABASE_URL user should only have the
 * grants the app needs.
 *
 * DATABASE_URL is a mysql:// URI, e.g.
 * mysql://user:password@127.0.0.1:3306/early_china_coinage
 * `timezone: 'Z'` keeps Better Auth's Date values in UTC, matching how the
 * migrated created_at columns were written. The connection collation is
 * MySQL 8's server default rather than mysql2's utf8mb4_unicode_ci: views
 * like v_source_link_targets build columns from string literals, which take
 * the server default, and comparing them to a unicode_ci parameter fails
 * with "Illegal mix of collations". Cached on globalThis so dev-mode HMR
 * doesn't open a new pool per reload.
 */
const globalForDb = globalThis as unknown as { mysqlPool?: Pool }

function getPool() {
  if (!globalForDb.mysqlPool) {
    const uri = process.env.DATABASE_URL?.trim()
    if (!uri) throw new Error('Missing DATABASE_URL in .env.local (mysql://user:password@host:3306/database).')
    globalForDb.mysqlPool = createPool({ uri, connectionLimit: 5, timezone: 'Z', charset: 'UTF8MB4_0900_AI_CI' })
  }
  return globalForDb.mysqlPool
}

export const pool = getPool()
export const db = drizzle({ client: pool, schema, mode: 'default' })
export type Db = typeof db
