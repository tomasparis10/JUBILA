import 'server-only'

import { createHash } from 'crypto'

const WINDOW_MS = 15 * 60 * 1000
const BLOCK_MS = 15 * 60 * 1000
const MAX_FAILURES = 5
const MAX_ENTRIES = 5_000

interface AttemptState {
  failures: number[]
  blockedUntil: number
}

const globalForRateLimit = globalThis as unknown as {
  loginAttempts?: Map<string, AttemptState>
}

const attempts = globalForRateLimit.loginAttempts ?? new Map<string, AttemptState>()
globalForRateLimit.loginAttempts = attempts

function keyFor(username: string, clientAddress: string): string {
  return createHash('sha256')
    .update(`${clientAddress}\0${username.trim().toLocaleLowerCase('es')}`)
    .digest('hex')
}

function prune(now: number): void {
  for (const [key, state] of attempts) {
    state.failures = state.failures.filter((timestamp) => now - timestamp < WINDOW_MS)
    if (state.failures.length === 0 && state.blockedUntil <= now) attempts.delete(key)
  }

  while (attempts.size > MAX_ENTRIES) {
    const oldestKey = attempts.keys().next().value as string | undefined
    if (!oldestKey) break
    attempts.delete(oldestKey)
  }
}

export function isLoginBlocked(username: string, clientAddress: string): boolean {
  const now = Date.now()
  prune(now)
  const state = attempts.get(keyFor(username, clientAddress))
  return Boolean(state && state.blockedUntil > now)
}

export function recordLoginFailure(username: string, clientAddress: string): void {
  const now = Date.now()
  const key = keyFor(username, clientAddress)
  const state = attempts.get(key) ?? { failures: [], blockedUntil: 0 }
  state.failures = state.failures.filter((timestamp) => now - timestamp < WINDOW_MS)
  state.failures.push(now)
  if (state.failures.length >= MAX_FAILURES) state.blockedUntil = now + BLOCK_MS
  attempts.set(key, state)
  console.warn(`[login-rate-limit] intento fallido key=${key.slice(0, 12)} failures=${state.failures.length}`)
  prune(now)
}

export function clearLoginFailures(username: string, clientAddress: string): void {
  attempts.delete(keyFor(username, clientAddress))
}
