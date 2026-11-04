import { createAuthClient } from 'better-auth/react'

/** Browser-side Better Auth client; talks to app/api/auth/[...all]. */
export const authClient = createAuthClient()
