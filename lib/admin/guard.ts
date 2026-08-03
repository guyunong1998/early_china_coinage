import 'server-only'

/**
 * Every table's RLS grants SELECT only to the anon/public role (verified
 * live against Supabase — no INSERT/UPDATE/DELETE policy exists on any
 * table). supabaseAdmin (lib/supabase-admin.ts) is the only thing that can
 * write, so this check is the only thing standing between it and the public
 * internet. Every exported function in every lib/admin/*-actions.ts file
 * must call this as its FIRST line, before touching FormData or
 * supabaseAdmin — a Server Action is invoked as a POST resolved server-side
 * back to this function body, so even a raw POST to a captured action
 * reference on a production deployment still hits this throw first.
 */
export function assertDevOnly(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Editing is disabled in production.')
  }
}

/** Server-side-only convenience for gating which UI renders — pass down as a
 * plain boolean prop, never recomputed on the client. */
export function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production'
}
