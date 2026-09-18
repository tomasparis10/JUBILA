'use server'

import { prisma } from '@/lib/prisma'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import bcrypt from 'bcryptjs'
import { logServerError } from '@/lib/safe-error'

export type RolUsuario = 'ADMIN' | 'JUBILA'
const ROLES_VALIDOS: readonly RolUsuario[] = ['ADMIN', 'JUBILA']

export interface UsuarioListado {
  id: number
  nombreUsuario: string
  rol: string
  debeCambiarContrasena: boolean
}

export interface RespuestaAccion {
  ok: boolean
  error?: string
}

/** Verifica que la sesión activa pertenezca a un ADMIN. */
async function requireAdmin(): Promise<{ userId: number; username: string }> {
  const session = await requireAuthenticatedSession()
  if (session.role !== 'ADMIN') {
    throw new Error('No autorizado. Esta función requiere rol ADMIN.')
  }
  return { userId: session.userId, username: session.username }
}

export async function listUsuarios(): Promise<UsuarioListado[]> {
  try {
    await requireAdmin()
    const usuarios = await prisma.uSUARIO.findMany({
      orderBy: { NOMBRE_USUARIO: 'asc' },
      select: {
        ID_USUARIO: true,
        NOMBRE_USUARIO: true,
        ROL: true,
        DEBE_CAMBIAR_CONTRASENA: true,
      },
    })
    return usuarios.map((u) => ({
      id: u.ID_USUARIO,
      nombreUsuario: u.NOMBRE_USUARIO,
      rol: u.ROL,
      debeCambiarContrasena: u.DEBE_CAMBIAR_CONTRASENA,
    }))
  } catch (error) {
    logServerError('[listUsuarios] Error:', error)
    return []
  }
}

export async function crearUsuario(
  nombreUsuario: string,
  rol: string,
  contrasenaInicial: string,
): Promise<RespuestaAccion> {
  try {
    await requireAdmin()
    const nombre = nombreUsuario.trim()
    if (!nombre || nombre.length > 100) {
      return { ok: false, error: 'El nombre de usuario debe tener entre 1 y 100 caracteres.' }
    }
    if (!ROLES_VALIDOS.includes(rol as RolUsuario)) {
      return { ok: false, error: 'Rol inválido. Solo se permiten ADMIN o JUBILA.' }
    }
    if (contrasenaInicial.length < 5 || contrasenaInicial.length > 25) {
      return { ok: false, error: 'La contraseña inicial debe tener entre 5 y 25 caracteres.' }
    }

    const existe = await prisma.uSUARIO.findUnique({ where: { NOMBRE_USUARIO: nombre } })
    if (existe) {
      return { ok: false, error: 'Ya existe un usuario con ese nombre.' }
    }

    const hash = await bcrypt.hash(contrasenaInicial, 12)
    await prisma.uSUARIO.create({
      data: {
        NOMBRE_USUARIO: nombre,
        CONTRASENA_USUARIO: hash,
        DEBE_CAMBIAR_CONTRASENA: true,
        ROL: (rol as RolUsuario).toUpperCase() === 'ADMIN' ? 'ADMIN' : 'JUBILA',
      },
    })
    return { ok: true }
  } catch (error) {
    logServerError('[crearUsuario] Error:', error)
    return { ok: false, error: 'No se pudo crear el usuario. Verificá el formulario.' }
  }
}

export async function actualizarRolUsuario(id: number, rol: string): Promise<RespuestaAccion> {
  try {
    const admin = await requireAdmin()
    if (!ROLES_VALIDOS.includes(rol as RolUsuario)) {
      return { ok: false, error: 'Rol inválido. Solo se permiten ADMIN o JUBILA.' }
    }

    const target = await prisma.uSUARIO.findUnique({ where: { ID_USUARIO: id } })
    if (!target) {
      return { ok: false, error: 'El usuario no existe.' }
    }

    if (id === admin.userId && rol !== 'ADMIN') {
      return { ok: false, error: 'No podés quitarte tu propio rol ADMIN.' }
    }
    if (rol !== 'ADMIN' && target.ROL === 'ADMIN') {
      const adminsRestantes = await prisma.uSUARIO.count({ where: { ROL: 'ADMIN' } })
      if (adminsRestantes <= 1) {
        return { ok: false, error: 'Debe existir al menos un usuario ADMIN en el sistema.' }
      }
    }

    await prisma.uSUARIO.update({
      where: { ID_USUARIO: id },
      data: { ROL: rol.toUpperCase() === 'ADMIN' ? 'ADMIN' : 'JUBILA' },
    })
    return { ok: true }
  } catch (error) {
    logServerError('[actualizarRolUsuario] Error:', error)
    return { ok: false, error: 'No se pudo actualizar el rol.' }
  }
}

export async function resetearContrasenaUsuario(id: number, contrasenaTemporal: string): Promise<RespuestaAccion> {
  try {
    await requireAdmin()
    const target = await prisma.uSUARIO.findUnique({ where: { ID_USUARIO: id } })
    if (!target) {
      return { ok: false, error: 'El usuario no existe.' }
    }
    if (contrasenaTemporal.length < 5 || contrasenaTemporal.length > 25) {
      return { ok: false, error: 'La contraseña temporal debe tener entre 5 y 25 caracteres.' }
    }

    const hash = await bcrypt.hash(contrasenaTemporal, 12)
    await prisma.uSUARIO.update({
      where: { ID_USUARIO: id },
      data: { CONTRASENA_USUARIO: hash, DEBE_CAMBIAR_CONTRASENA: true },
    })
    return { ok: true }
  } catch (error) {
    logServerError('[resetearContrasenaUsuario] Error:', error)
    return { ok: false, error: 'No se pudo resetear la contraseña.' }
  }
}

export async function eliminarUsuario(id: number): Promise<RespuestaAccion> {
  try {
    const admin = await requireAdmin()
    const target = await prisma.uSUARIO.findUnique({ where: { ID_USUARIO: id } })
    if (!target) {
      return { ok: false, error: 'El usuario no existe.' }
    }
    if (id === admin.userId) {
      return { ok: false, error: 'No podés eliminar tu propia cuenta.' }
    }
    if (target.ROL === 'ADMIN') {
      const adminsRestantes = await prisma.uSUARIO.count({ where: { ROL: 'ADMIN' } })
      if (adminsRestantes <= 1) {
        return { ok: false, error: 'Debe existir al menos un usuario ADMIN en el sistema.' }
      }
    }

    await prisma.sESION.updateMany({ where: { ID_USUARIO: id, FECHA_HORA_FIN: null }, data: { FECHA_HORA_FIN: new Date() } })
    await prisma.uSUARIO.delete({ where: { ID_USUARIO: id } })
    return { ok: true }
  } catch (error) {
    logServerError('[eliminarUsuario] Error:', error)
    return { ok: false, error: 'No se pudo eliminar el usuario (puede tener registros asociados).' }
  }
}