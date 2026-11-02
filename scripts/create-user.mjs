#!/usr/bin/env node
/**
 * Creates (or resets the password of) an email/password login for the edit UI.
 * Public sign-up is disabled in lib/auth/auth.ts, so this is the only way to
 * add an account; it needs DATABASE_URL, i.e. database credentials.
 * The account can only edit if its email is also in ADMIN_EMAILS.
 *
 *   node --env-file=.env.local scripts/create-user.mjs <email> [name]
 *
 * The password is prompted for rather than passed as an argument, where it
 * would end up in shell history and `ps` output.
 */
import { createInterface } from 'node:readline'
import { betterAuth } from 'better-auth'
import { createPool } from 'mysql2/promise'

const MIN_PASSWORD_LENGTH = 12

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

const [email, name = email?.split('@')[0]] = process.argv.slice(2)
if (!email) {
  console.error('Usage: node --env-file=.env.local scripts/create-user.mjs <email> [name]')
  process.exit(1)
}

const uri = process.env.DATABASE_URL?.trim()
if (!uri) {
  console.error('Missing DATABASE_URL.')
  process.exit(1)
}

const password = await promptHidden(`Password for ${email}: `)
if (password.length < MIN_PASSWORD_LENGTH) {
  console.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
  process.exit(1)
}
if ((await promptHidden('Repeat password: ')) !== password) {
  console.error('Passwords do not match.')
  process.exit(1)
}

const pool = createPool({ uri, timezone: 'Z', charset: 'UTF8MB4_0900_AI_CI' })
// Same database as the app's instance, but with sign-up enabled.
const auth = betterAuth({ database: pool, emailAndPassword: { enabled: true, autoSignIn: false } })

try {
  const ctx = await auth.$context
  const existing = await ctx.internalAdapter.findUserByEmail(email.toLowerCase())
  if (existing) {
    await ctx.internalAdapter.updatePassword(existing.user.id, await ctx.password.hash(password))
    // Also signs out every existing session, so a reset locks out anyone using the old password.
    await ctx.internalAdapter.deleteUserSessions(existing.user.id)
    console.log(`Password reset for ${email}; existing sessions signed out.`)
  } else {
    await auth.api.signUpEmail({ body: { email, password, name } })
    console.log(`Created ${email}.`)
  }
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase())
  if (!admins.includes(email.toLowerCase())) console.warn(`Note: ${email} is not in ADMIN_EMAILS, so it can't edit yet.`)
} finally {
  await pool.end()
}
