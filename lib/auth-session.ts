import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'

const SESSION_COOKIE = 'jubila_session'
const SESSION_DURATION_SECONDS = 8 * 60 * 60
const SESSION_IDLE_SECONDS = 6 * 60 * 60

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET debe tener al menos 32 caracteres.')
  }
  return secret
}

function sign(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('base64url')
}

function decodeCookie(value: string | undefined): { sessionId: number; lastActivity: number } | null {
  if (!value) return null
  const [sessionId, lastActivity, nonce, signature] = value.split('.')
  if (!/^\d+$/.test(sessionId) || !/^\d+$/.test(lastActivity) || !/^[a-f0-9]{32}$/.test(nonce) || !signature) return null

  const expected = Buffer.from(sign(`${sessionId}.${lastActivity}.${nonce}`))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null

  const parsed = Number(sessionId)
  const parsedActivity = Number(lastActivity)
  if (!Number.isSafeInteger(parsed) || !Number.isSafeInteger(parsedActivity)) return null
  return { sessionId: parsed, lastActivity: parsedActivity }
}

export async function setSessionCookie(sessionId: number): Promise<void> {
  const nonce = randomBytes(16).toString('hex')
  const payload = `${sessionId}.${Date.now()}.${nonce}`
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_IDLE_SECONDS,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}

export interface AuthenticatedSession {
  sessionId: number
  userId: number
  username: string
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const cookieStore = await cookies()
  const decoded = decodeCookie(cookieStore.get(SESSION_COOKIE)?.value)
  if (!decoded) return null
  const idleExpired = Date.now() - decoded.lastActivity >= SESSION_IDLE_SECONDS * 1000

  const session = await prisma.sESION.findUnique({
    where: { ID_SESION: decoded.sessionId },
    include: { USUARIO: true },
  })
  if (!session || session.FECHA_HORA_FIN) return null

  const expiresAt = session.FECHA_HORA_INICIO.getTime() + SESSION_DURATION_SECONDS * 1000
  if (idleExpired || Date.now() >= expiresAt) {
    await prisma.sESION.update({
      where: { ID_SESION: session.ID_SESION },
      data: { FECHA_HORA_FIN: new Date() },
    })
    return null
  }

  await setSessionCookie(session.ID_SESION)

  return {
    sessionId: session.ID_SESION,
    userId: session.ID_USUARIO,
    username: session.USUARIO.NOMBRE_USUARIO,
  }
}

export async function requireAuthenticatedSession(): Promise<AuthenticatedSession> {
  const session = await getAuthenticatedSession()
  if (!session) throw new Error('Sesión inválida o vencida. Ingrese nuevamente.')
  return session
}
