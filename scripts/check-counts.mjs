#!/usr/bin/env node
/**
 * Read-only check that a database is reachable and populated: prints the row
 * counts of finds, sites, sources and the Better Auth user table.
 *
 *   node scripts/check-counts.mjs
 *
 * Uses DATABASE_URL from the environment, else from .env.local; if neither has
 * it, the mysql:// URL is prompted for (hidden), so an owner/admin URL never
 * has to go into a file or shell history. The session is set READ ONLY, so the
 * server itself rejects any write, and the password is never printed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { createConnection } from 'mysql2/promise'

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    let muted = false
    rl._writeToOutput = (s) => {
      if (!muted) rl.output.write(s)
    }
    rl.question(question, (answer) => {
      rl.close()
      process.stdout.write('\n')
      resolve(answer)
    })
    muted = true
  })
}

/** DATABASE_URL from .env.local, read by hand so this works on any Node version. */
function urlFromEnvLocal() {
  if (!existsSync('.env.local')) return undefined
  const line = readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .reverse() // the last assignment wins, as with dotenv
    .find((l) => /^\s*DATABASE_URL\s*=/.test(l))
  return line?.replace(/^\s*DATABASE_URL\s*=\s*/, '').trim().replace(/^(['"])(.*)\1$/, '$2')
}

let uri = process.env.DATABASE_URL?.trim()
if (!uri) {
  uri = urlFromEnvLocal()
  if (uri) console.log('Using DATABASE_URL from .env.local')
}
if (!uri) uri = (await promptHidden('Database URL (mysql://user:password@host:port/db): ')).trim()
if (!uri) {
  console.error('No database URL given.')
  process.exit(1)
}

let target
try {
  target = new URL(uri)
} catch {
  console.error('That is not a valid URL (expected mysql://user:password@host:port/database).')
  process.exit(1)
}
console.log(`Connecting to ${decodeURIComponent(target.username)}@${target.hostname}:${target.port || 3306}${target.pathname} ...`)

let conn
try {
  conn = await createConnection({ uri, connectTimeout: 10000 })
  await conn.query('SET SESSION TRANSACTION READ ONLY')
  const [[row]] = await conn.query(
    'SELECT (SELECT COUNT(*) FROM finds) f, (SELECT COUNT(*) FROM sites) s, (SELECT COUNT(*) FROM sources) so, (SELECT COUNT(*) FROM `user`) u'
  )
  console.log(`finds: ${row.f}  sites: ${row.s}  sources: ${row.so}  users: ${row.u}`)
} catch (err) {
  console.error(`Failed: ${err.code ?? ''} ${err.message}`)
  process.exitCode = 1
} finally {
  await conn?.end()
}
