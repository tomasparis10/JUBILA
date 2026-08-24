'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

// Tipos de archivo permitidos
const TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
const EXTENSIONES_PERMITIDAS = ['.pdf', '.jpg', '.jpeg', '.png']
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB
const MAX_ARCHIVOS = 5

export interface ArchivoMeta {
  id: number
  nombre: string
  tipo: string | null
  fechaSubida: string
  jubilaId: number
}

/**
 * Lista los metadatos de archivos de un JUBILA (SIN traer DATOS_ARCHIVO para no saturar la red).
 */
export async function listarArchivos(jubilaId: number): Promise<ArchivoMeta[]> {
  if (!jubilaId || isNaN(jubilaId)) return []
  try {
    const archivos = await prisma.aRCHIVO_JUBILACION.findMany({
      where: { ID_JUBILA: jubilaId },
      select: {
        ID_ARCHIVO: true,
        NOMBRE_ARCHIVO: true,
        TIPO_ARCHIVO: true,
        FECHA_SUBIDA: true,
        ID_JUBILA: true,
        // DATOS_ARCHIVO excluido intencionalmente
      },
      orderBy: { FECHA_SUBIDA: 'desc' },
    })

    return archivos.map((a) => ({
      id: a.ID_ARCHIVO,
      nombre: a.NOMBRE_ARCHIVO,
      tipo: a.TIPO_ARCHIVO,
      fechaSubida: a.FECHA_SUBIDA.toISOString(),
      jubilaId: a.ID_JUBILA,
    }))
  } catch (error) {
    console.error('[listarArchivos] Error:', error)
    return []
  }
}

/**
 * Sube uno o varios archivos (FormData) y los guarda en ARCHIVO_JUBILACION.
 * Valida tipo y tamaño en el servidor.
 */
export async function subirArchivos(
  formData: FormData,
  jubilaId: number,
  usuarioId: number = 1,
): Promise<{ ok: boolean; subidos: number; errores: string[] }> {
  const errores: string[] = []
  let subidos = 0

  const files = formData.getAll('archivos') as File[]

  if (!files || files.length === 0) {
    return { ok: false, subidos: 0, errores: ['No se recibieron archivos.'] }
  }
  if (files.length > MAX_ARCHIVOS) {
    return { ok: false, subidos: 0, errores: [`Solo se permiten hasta ${MAX_ARCHIVOS} archivos por vez.`] }
  }

  for (const file of files) {
    // Validacion de tipo
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!TIPOS_PERMITIDOS.includes(file.type) && !EXTENSIONES_PERMITIDAS.includes(ext)) {
      errores.push(`"${file.name}": Tipo no permitido. Use PDF, JPG o PNG.`)
      continue
    }

    // Validacion de tamaño
    if (file.size > MAX_SIZE_BYTES) {
      errores.push(`"${file.name}": Excede el tamaño máximo de 10 MB.`)
      continue
    }

    try {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      await prisma.aRCHIVO_JUBILACION.create({
        data: {
          ID_JUBILA: jubilaId,
          NOMBRE_ARCHIVO: file.name,
          TIPO_ARCHIVO: file.type || null,
          DATOS_ARCHIVO: buffer,
          FECHA_SUBIDA: new Date(),
          USUARIO_SUBIDA: usuarioId,
        },
      })
      subidos++
    } catch (error) {
      console.error(`[subirArchivos] Error al guardar "${file.name}":`, error)
      errores.push(`"${file.name}": Error al guardar en la base de datos.`)
    }
  }

  revalidatePath('/')
  return { ok: subidos > 0, subidos, errores }
}

/**
 * Elimina un archivo por su ID.
 */
export async function eliminarArchivo(
  archivoId: number,
): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.aRCHIVO_JUBILACION.delete({
      where: { ID_ARCHIVO: archivoId },
    })
    revalidatePath('/')
    return { ok: true }
  } catch (error) {
    console.error('[eliminarArchivo] Error:', error)
    return { ok: false, error: 'No se pudo eliminar el archivo.' }
  }
}
