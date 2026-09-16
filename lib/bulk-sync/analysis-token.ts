import 'server-only'

import { createHash, createHmac, timingSafeEqual } from 'crypto'
import type { AuthenticatedSession } from '@/lib/auth-session'
import type { AnalysisResult } from '@/lib/bulk-sync/types'

const TOKEN_VERSION = 1
const TOKEN_AUDIENCE = 'bulk-sync-commit'
const TOKEN_TTL_SECONDS = 10 * 60
export const MAX_BULK_SYNC_TOKEN_LENGTH = 2048

interface AnalysisTokenClaims {
  v: number
  aud: string
  sid: number
  uid: number
  iat: number
  exp: number
  hash: string
}

function getSecret(): string {
  const secret = process.env.BULK_SYNC_TOKEN_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('BULK_SYNC_TOKEN_SECRET debe tener al menos 32 caracteres.')
  }
  return secret
}

/** Serializa valores JSON ordenando recursivamente las claves de los objetos. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) throw new TypeError('El valor no es JSON serializable.')
    return serialized
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => item === undefined ? 'null' : canonicalJson(item)).join(',')}]`
  }

  const record = value as Record<string, unknown>
  const entries = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
  return `{${entries.join(',')}}`
}

function hashAnalysis(analysis: AnalysisResult): string {
  return createHash('sha256').update(canonicalJson(analysis)).digest('hex')
}

function signature(payload: string): Buffer {
  return createHmac('sha256', getSecret()).update(payload).digest()
}

export function issueAnalysisToken(
  analysis: AnalysisResult,
  session: AuthenticatedSession,
): string {
  const iat = Math.floor(Date.now() / 1000)
  const claims: AnalysisTokenClaims = {
    v: TOKEN_VERSION,
    aud: TOKEN_AUDIENCE,
    sid: session.sessionId,
    uid: session.userId,
    iat,
    exp: iat + TOKEN_TTL_SECONDS,
    hash: hashAnalysis(analysis),
  }
  const encodedClaims = Buffer.from(canonicalJson(claims)).toString('base64url')
  const payload = `bs1.${encodedClaims}`
  return `${payload}.${signature(payload).toString('base64url')}`
}

export function verifyAnalysisToken(
  token: string,
  analysis: AnalysisResult,
  session: AuthenticatedSession,
): boolean {
  if (!token || token.length > MAX_BULK_SYNC_TOKEN_LENGTH) return false

  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'bs1' || !parts[1] || !parts[2]) return false

  const payload = `bs1.${parts[1]}`
  let receivedSignature: Buffer
  let decodedClaims: unknown
  try {
    receivedSignature = Buffer.from(parts[2], 'base64url')
    decodedClaims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as unknown
  } catch {
    return false
  }

  const expectedSignature = signature(payload)
  if (
    receivedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(receivedSignature, expectedSignature)
  ) return false

  if (!decodedClaims || typeof decodedClaims !== 'object' || Array.isArray(decodedClaims)) return false
  const claims = decodedClaims as AnalysisTokenClaims
  const now = Math.floor(Date.now() / 1000)
  const claimKeys = Object.keys(claims).sort().join(',')
  if (
    claimKeys !== 'aud,exp,hash,iat,sid,uid,v' ||
    claims.v !== TOKEN_VERSION ||
    claims.aud !== TOKEN_AUDIENCE ||
    claims.sid !== session.sessionId ||
    claims.uid !== session.userId ||
    !Number.isSafeInteger(claims.iat) ||
    !Number.isSafeInteger(claims.exp) ||
    claims.exp - claims.iat !== TOKEN_TTL_SECONDS ||
    claims.iat > now + 60 ||
    claims.exp <= now ||
    !/^[a-f0-9]{64}$/.test(claims.hash)
  ) return false

  const expectedHash = Buffer.from(hashAnalysis(analysis), 'hex')
  const receivedHash = Buffer.from(claims.hash, 'hex')
  return receivedHash.length === expectedHash.length && timingSafeEqual(receivedHash, expectedHash)
}
