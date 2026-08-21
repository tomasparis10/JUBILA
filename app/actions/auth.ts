'use server'

import { prisma } from '@/lib/prisma'

export interface LoginResult {
  ok: boolean
  username?: string
  userId?: number
  error?: string
}

/**
 * Autentica un usuario contra la tabla USUARIO de SQL Server.
 * NOTA: Las contraseñas en DB deben estar hasheadas. Si actualmente están
 * en texto plano, esta función hace comparación directa (mejorar con bcrypt).
 */
export async function loginUsuario(
  nombreUsuario: string,
  contrasena: string,
): Promise<LoginResult> {
  try {
    if (!nombreUsuario.trim() || !contrasena.trim()) {
      return { ok: false, error: 'Usuario y contraseña son obligatorios.' }
    }

    const usuario = await prisma.uSUARIO.findUnique({
      where: { NOMBRE_USUARIO: nombreUsuario.trim() },
    })

    if (!usuario) {
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }

    // Comparación directa (si las passwords están en texto plano en la DB)
    // Si están hasheadas con bcrypt, reemplazar por: await bcrypt.compare(contrasena, usuario.CONTRASENA_USUARIO)
    const passwordOk = contrasena === usuario.CONTRASENA_USUARIO

    if (!passwordOk) {
      return { ok: false, error: 'Usuario o contraseña incorrectos.' }
    }

    // Registrar inicio de sesión
    await prisma.sESION.create({
      data: {
        ID_USUARIO: usuario.ID_USUARIO,
        FECHA_HORA_INICIO: new Date(),
      },
    })

    return {
      ok: true,
      username: usuario.NOMBRE_USUARIO,
      userId: usuario.ID_USUARIO,
    }
  } catch (error) {
    console.error('[loginUsuario] Error:', error)
    return { ok: false, error: 'Error al conectar con el servidor. Intente nuevamente.' }
  }
}

/**
 * Registra el cierre de sesión actualizando FECHA_HORA_FIN en la última sesión activa.
 */
export async function logoutUsuario(userId: number): Promise<void> {
  try {
    const sesionActiva = await prisma.sESION.findFirst({
      where: { ID_USUARIO: userId, FECHA_HORA_FIN: null },
      orderBy: { FECHA_HORA_INICIO: 'desc' },
    })
    if (sesionActiva) {
      await prisma.sESION.update({
        where: { ID_SESION: sesionActiva.ID_SESION },
        data: { FECHA_HORA_FIN: new Date() },
      })
    }
  } catch (error) {
    console.error('[logoutUsuario] Error:', error)
  }
}
