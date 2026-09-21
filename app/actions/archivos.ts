'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuthenticatedSession } from '@/lib/auth-session'

const MAX_SIZE_BYTES = 10 * 1024 * 1024
const MAX_TOTAL_BYTES = 25 * 1024 * 1024
const MAX_ARCHIVOS = 5
const MAX_NOMBRE_LENGTH = 180

type TipoDetectado = {
  mime: 'application/pdf' | 'image/jpeg' | 'image/png'
  extension: '.pdf' | '.jpg' | '.png'
  extensionesCompatibles: readonly string[]
}

function esIdValido(id: number): boolean {
  return Number.isSafeInteger(id) && id > 0
}

function detectarTipo(buffer: Buffer): TipoDetectado | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).equals(Buffer.from('%PDF-'))) {
    return { mime: 'application/pdf', extension: '.pdf', extensionesCompatibles: ['.pdf'] }
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', extension: '.jpg', extensionesCompatibles: ['.jpg', '.jpeg'] }
  }
  if (
    buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return { mime: 'image/png', extension: '.png', extensionesCompatibles: ['.png'] }
  }
  return null
}

function sanitizarNombre(nombreOriginal: string, tipo: TipoDetectado): string | null {
  const basename = nombreOriginal.split(/[\\/]/).pop()?.normalize('NFKC') ?? ''
  const extension = basename.match(/\.[^.]*$/)?.[0].toLowerCase() ?? ''
  if (!tipo.extensionesCompatibles.includes(extension)) return null

  const stem = basename.slice(0, basename.length - extension.length)
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069'"`“”‘’\\/]/g, '')
    .replace(/[. ]+$/g, '')
    .trim()
  const stemSeguro = stem || 'archivo'
  const maxStemLength = MAX_NOMBRE_LENGTH - tipo.extension.length
  const stemLimitado = Array.from(stemSeguro).slice(0, maxStemLength).join('').replace(/[. ]+$/g, '') || 'archivo'
  return `${stemLimitado}${tipo.extension}`
}

export interface ArchivoMeta {
  id: number
  nombre: string
  tipo: string | null
  fechaSubida: string
  jubilaId: number
}

/** Lista metadatos sin cargar los blobs. */
export async function listarArchivos(jubilaId: number): Promise<ArchivoMeta[]> {
  await requireAuthenticatedSession()
  if (!esIdValido(jubilaId)) return []

  try {
    const jubila = await prisma.jUBILA.findFirst({
      where: { ID_JUBILA: jubilaId, BIT_BORRADO: false },
      select: {
        ARCHIVO_JUBILACION: {
          where: { BIT_BORRADO: false },
          select: {
            ID_ARCHIVO: true,
            NOMBRE_ARCHIVO: true,
            TIPO_ARCHIVO: true,
            FECHA_SUBIDA: true,
            ID_JUBILA: true,
          },
          orderBy: { FECHA_SUBIDA: 'desc' },
        },
      },
    })

    return (jubila?.ARCHIVO_JUBILACION ?? []).map((archivo) => ({
      id: archivo.ID_ARCHIVO,
      nombre: archivo.NOMBRE_ARCHIVO,
      tipo: archivo.TIPO_ARCHIVO,
      fechaSubida: archivo.FECHA_SUBIDA.toISOString(),
      jubilaId: archivo.ID_JUBILA,
    }))
  } catch (error) {
    console.error('[listarArchivos] Error al consultar archivos:', error instanceof Error ? error.name : 'Error')
    return []
  }
}

/** Valida el lote completo y lo persiste de forma atomica. */
export async function subirArchivos(
  formData: FormData,
  jubilaId: number,
): Promise<{ ok: boolean; subidos: number; errores: string[] }> {
  const { userId: usuarioId } = await requireAuthenticatedSession()
  const error = (mensaje: string) => ({ ok: false, subidos: 0, errores: [mensaje] })

  if (!esIdValido(jubilaId)) return error('Solicitud de archivos inválida.')

  let jubila: { ID_JUBILA: number } | null
  try {
    jubila = await prisma.jUBILA.findFirst({
      where: { ID_JUBILA: jubilaId, BIT_BORRADO: false },
      select: { ID_JUBILA: true },
    })
  } catch (dbError) {
    console.error('[subirArchivos] Error al validar JUBILA:', dbError instanceof Error ? dbError.name : 'Error')
    return error('No se pudo procesar la solicitud de archivos.')
  }
  if (!jubila) return error('No se pudo procesar la solicitud de archivos.')

  const entries = Array.from(formData.entries())
  if (
    entries.length === 0
    || entries.length > MAX_ARCHIVOS
    || !entries.every(([campo, entry]) => campo === 'archivos' && entry instanceof File)
  ) {
    return error('El lote de archivos no es válido.')
  }

  const files = entries.map(([, entry]) => entry as File)
  if (files.some((file) => file.size <= 0 || file.size > MAX_SIZE_BYTES)) {
    return error('Uno o más archivos tienen un tamaño no permitido.')
  }
  if (files.reduce((total, file) => total + file.size, 0) > MAX_TOTAL_BYTES) {
    return error('El lote de archivos supera el tamaño total permitido.')
  }

  const validados: Array<{ nombre: string; tipo: TipoDetectado; datos: Buffer }> = []
  for (const file of files) {
    let datos: Buffer
    try {
      datos = Buffer.from(await file.arrayBuffer())
    } catch (readError) {
      console.error('[subirArchivos] Error al leer archivo:', readError instanceof Error ? readError.name : 'Error')
      return error('No se pudieron procesar los archivos.')
    }
    if (datos.length === 0 || datos.length > MAX_SIZE_BYTES) {
      return error('Uno o más archivos tienen un tamaño no permitido.')
    }
    const tipo = detectarTipo(datos)
    const nombre = tipo ? sanitizarNombre(file.name, tipo) : null
    if (!tipo || !nombre) return error('Uno o más archivos tienen un formato no permitido.')
    validados.push({ nombre, tipo, datos })
  }

  try {
    await prisma.$transaction(
      validados.map((archivo) => prisma.aRCHIVO_JUBILACION.create({
        data: {
          ID_JUBILA: jubilaId,
          NOMBRE_ARCHIVO: archivo.nombre,
          TIPO_ARCHIVO: archivo.tipo.mime,
          DATOS_ARCHIVO: archivo.datos,
          FECHA_SUBIDA: new Date(),
          USUARIO_SUBIDA: usuarioId,
        },
      })),
    )
    revalidatePath('/')
    return { ok: true, subidos: validados.length, errores: [] }
  } catch (dbError) {
    console.error('[subirArchivos] Error al guardar lote:', dbError instanceof Error ? dbError.name : 'Error')
    return error('No se pudieron guardar los archivos.')
  }
}

/** Borrado logico: marca BIT_BORRADO, conservando el registro (y sus datos) en la base. */
export async function eliminarArchivo(
  archivoId: number,
): Promise<{ ok: boolean; error?: string }> {
  const { userId: usuarioId } = await requireAuthenticatedSession()
  if (!esIdValido(archivoId)) return { ok: false, error: 'Solicitud de archivo inválida.' }

  try {
    const archivo = await prisma.aRCHIVO_JUBILACION.findFirst({
      where: {
        ID_ARCHIVO: archivoId,
        BIT_BORRADO: false,
        JUBILA: { is: { BIT_BORRADO: false } },
      },
      select: { ID_ARCHIVO: true },
    })
    if (!archivo) return { ok: false, error: 'No se pudo eliminar el archivo.' }

    await prisma.aRCHIVO_JUBILACION.update({
      where: { ID_ARCHIVO: archivo.ID_ARCHIVO },
      data: {
        BIT_BORRADO: true,
        FECHA_ELIMINACION: new Date(),
        USUARIO_ELIMINACION: usuarioId,
      },
    })
    revalidatePath('/')
    return { ok: true }
  } catch (error) {
    console.error('[eliminarArchivo] Error al eliminar archivo:', error instanceof Error ? error.name : 'Error')
    return { ok: false, error: 'No se pudo eliminar el archivo.' }
  }
}
