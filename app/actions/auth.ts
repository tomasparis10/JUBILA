'use server'

import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'
import bcrypt from 'bcryptjs'
import {
  clearSessionCookie,
  getAuthenticatedSession,
  setSessionCookie,
} from '@/lib/auth-session'
import {
  clearLoginFailures,
  isLoginBlocked,
  recordLoginFailure,
} from '@/lib/login-rate-limit'
import { logServerError } from '@/lib/safe-error'

export interface LoginResult {
  ok: boolean
  username?: string
  userId?: number
  role?: string
  mustChangePassword?: boolean
  error?: string
}

export async function loginUsuario(
  nombreUsuario: string,
  contrasena: string,
): Promise<LoginResult> {
  const username = nombreUsuario.trim()
  // Server Actions no exponen una IP de forma portable entre runtimes.
  // El limiter puede sustituirse por Redis/SQL cuando se despliegue en varias instancias.
  const clientAddress = 'server-action'

  try {
    if (!process.env.DATABASE_URL) {
      console.error('[loginUsuario] DATABASE_URL no está configurada en las variables de entorno.')
      return { ok: false, error: 'El servicio no está disponible temporalmente.' }
    }

    if (!username || !contrasena.trim()) {
      return { ok: false, error: 'Usuario y contraseña son obligatorios.' }
    }
    if (username.length > 100 || contrasena.length > 255) {
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }
    if (isLoginBlocked(username, clientAddress)) {
      return { ok: false, error: 'Se alcanzó el límite de 5 intentos.' }
    }

    const usuario = await prisma.uSUARIO.findUnique({
      where: { NOMBRE_USUARIO: username },
    })

    if (!usuario) {
      recordLoginFailure(username, clientAddress)
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }

    const tieneHashBcrypt = /^\$2[aby]\$\d{2}\$/.test(usuario.CONTRASENA_USUARIO)
    const passwordOk = tieneHashBcrypt
      ? await bcrypt.compare(contrasena, usuario.CONTRASENA_USUARIO)
      : contrasena === usuario.CONTRASENA_USUARIO

    if (!passwordOk) {
      recordLoginFailure(username, clientAddress)
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }

    // Compatibilidad de una sola vez para usuarios creados manualmente en SQL.
    // La contraseña se reemplaza por un hash antes de finalizar el login.
    if (!tieneHashBcrypt) {
      const hash = await bcrypt.hash(contrasena, 12)
      await prisma.uSUARIO.update({
        where: { ID_USUARIO: usuario.ID_USUARIO },
        data: { CONTRASENA_USUARIO: hash, DEBE_CAMBIAR_CONTRASENA: true },
      })
    }

    clearLoginFailures(username, clientAddress)

    // Registrar inicio de sesión
    const sesion = await prisma.sESION.create({
      data: {
        ID_USUARIO: usuario.ID_USUARIO,
        FECHA_HORA_INICIO: new Date(),
      },
    })
    await setSessionCookie(sesion.ID_SESION)

    return {
      ok: true,
      username: usuario.NOMBRE_USUARIO,
      userId: usuario.ID_USUARIO,
      role: usuario.ROL,
      mustChangePassword: usuario.DEBE_CAMBIAR_CONTRASENA || !tieneHashBcrypt,
    }
  } catch (error) {
    const errorId = randomUUID()
    logServerError(`[loginUsuario] errorId=${errorId}`, error)
    return { ok: false, error: `Error interno. Contacte al administrador con el código ${errorId}.` }
  }
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await getAuthenticatedSession()
    if (!session) return { ok: false, error: 'Sesión inválida o vencida.' }
    if (newPassword.length < 5 || newPassword.length > 25) {
      return { ok: false, error: 'La nueva contraseña debe tener entre 5 y 25 caracteres.' }
    }
    if (currentPassword === newPassword) {
      return { ok: false, error: 'La nueva contraseña debe ser diferente.' }
    }
    const usuario = await prisma.uSUARIO.findUnique({ where: { ID_USUARIO: session.userId } })
    if (!usuario || !(await bcrypt.compare(currentPassword, usuario.CONTRASENA_USUARIO))) {
      return { ok: false, error: 'La contraseña actual es incorrecta.' }
    }
    const hash = await bcrypt.hash(newPassword, 12)
    await prisma.uSUARIO.update({
      where: { ID_USUARIO: session.userId },
      data: { CONTRASENA_USUARIO: hash, DEBE_CAMBIAR_CONTRASENA: false },
    })
    return { ok: true }
  } catch (error) {
    const errorId = randomUUID()
    logServerError(`[changePassword] errorId=${errorId}`, error)
    return { ok: false, error: `No se pudo cambiar la contraseña. Código: ${errorId}.` }
  }
}

/**
 * Registra el cierre de sesión actualizando FECHA_HORA_FIN en la última sesión activa.
 */
export async function logoutUsuario(): Promise<void> {
  try {
    const sesionActiva = await getAuthenticatedSession()
    if (sesionActiva) {
      await prisma.sESION.update({
        where: { ID_SESION: sesionActiva.sessionId },
        data: { FECHA_HORA_FIN: new Date() },
      })
    }
  } catch (error) {
    logServerError('[logoutUsuario] Error:', error)
  } finally {
    await clearSessionCookie()
  }
}

export async function getCurrentSession(): Promise<LoginResult> {
  try {
    const session = await getAuthenticatedSession()
    if (!session) {
      await clearSessionCookie()
      return { ok: false }
    }
    return {
      ok: true,
      username: session.username,
      userId: session.userId,
      role: session.role,
      mustChangePassword: session.mustChangePassword,
    }
  } catch (error) {
    logServerError('[getCurrentSession] Error:', error)
    return { ok: false }
  }
}
