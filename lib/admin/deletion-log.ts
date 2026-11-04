import 'server-only'
import { appendFile, mkdir } from 'fs/promises'
import path from 'path'
import type { SQL } from 'drizzle-orm'
import type { Db } from '@/lib/db'

/** Where deleted rows are recorded: one JSON line per row, every column
 * intact, so anything deleted through the edit UI can be put back by hand.
 * Keep it outside any directory a deploy replaces (e.g. the standalone build). */
const LOG_PATH = process.env.AUDIT_LOG_PATH || path.join(process.cwd(), 'logs', 'deletions.log')

type Snapshot = { table: string; query: SQL }
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]

/**
 * Selects every row the delete will remove — including rows ON DELETE CASCADE
 * takes with it, which is why each caller lists those too — runs the delete
 * in the same transaction, and once it commits appends the snapshots to the
 * deletion log. If the delete fails (e.g. a foreign key blocks it), nothing
 * is logged.
 */
export async function deleteWithLog(db: Db, snapshots: Snapshot[], runDelete: (tx: Tx) => Promise<unknown>) {
  const deleted = await db.transaction(async (tx) => {
    const rows: { table: string; row: unknown }[] = []
    for (const { table, query } of snapshots) {
      const [result] = await tx.execute(query)
      for (const row of result as unknown as unknown[]) rows.push({ table, row })
    }
    await runDelete(tx)
    return rows
  })
  if (deleted.length === 0) return

  const deletedAt = new Date().toISOString()
  const lines = deleted.map((d) => JSON.stringify({ deleted_at: deletedAt, ...d })).join('\n') + '\n'
  try {
    await mkdir(path.dirname(LOG_PATH), { recursive: true })
    await appendFile(LOG_PATH, lines)
  } catch (err) {
    // The rows are already gone — keep them in the server log rather than lose them.
    console.error(`Could not write ${LOG_PATH}; deleted rows follow:\n${lines}`, err)
  }
}
