import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthenticatedSession } from '@/lib/auth-session'

type TipoDetectado = {
  mime: 'application/pdf' | 'image/jpeg' | 'image/png'
  extension: '.pdf' | '.jpg' | '.png'
}

function detectarTipo(datos: Uint8Array): TipoDetectado | null {
  const coincide = (firma: readonly number[]) => firma.every((byte, index) => datos[index] === byte)
  if (datos.length >= 5 && coincide([0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: 'application/pdf', extension: '.pdf' }
  }
  if (datos.length >= 3 && coincide([0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', extension: '.jpg' }
  }
  if (datos.length >= 8 && coincide([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', extension: '.png' }
  }
  return null
}

function nombreSeguro(nombreOriginal: string, extension: TipoDetectado['extension']): string {
  const basename = nombreOriginal.split(/[\\/]/).pop()?.normalize('NFKC') ?? ''
  const stem = basename.replace(/\.[^.]*$/, '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069'"`“”‘’\\/]/g, '')
    .replace(/[. ]+$/g, '')
    .trim() || 'archivo'
  const limitado = Array.from(stem).slice(0, 180 - extension.length).join('').replace(/[. ]+$/g, '') || 'archivo'
  return `${limitado}${extension}`
}

function codificarRfc5987(valor: string): string {
  return encodeURIComponent(valor).replace(/['()*]/g, (caracter) =>
    `%${caracter.charCodeAt(0).toString(16).toUpperCase()}`,
  )
}

/** Entrega solo archivos reconocidos que pertenezcan a un JUBILA activo. */
export async function GET(request: NextRequest) {
  if (!await getAuthenticatedSession()) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 })
  }

  const idStr = request.nextUrl.searchParams.get('id')
  if (!idStr || !/^\d+$/.test(idStr)) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }
  const archivoId = Number(idStr)
  if (!Number.isSafeInteger(archivoId) || archivoId <= 0) {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 })
  }

  try {
    const archivo = await prisma.aRCHIVO_JUBILACION.findFirst({
      where: {
        ID_ARCHIVO: archivoId,
        BIT_BORRADO: false,
        JUBILA: { is: { BIT_BORRADO: false } },
      },
      select: {
        DATOS_ARCHIVO: true,
        NOMBRE_ARCHIVO: true,
      },
    })

    if (!archivo) {
      return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })
    }

    const tipo = detectarTipo(archivo.DATOS_ARCHIVO)
    if (!tipo) {
      return NextResponse.json({ error: 'Formato de archivo no compatible.' }, { status: 415 })
    }

    const nombre = nombreSeguro(archivo.NOMBRE_ARCHIVO, tipo.extension)
    return new NextResponse(archivo.DATOS_ARCHIVO, {
      status: 200,
      headers: {
        'Content-Type': tipo.mime,
        'Content-Disposition': `inline; filename="archivo${tipo.extension}"; filename*=UTF-8''${codificarRfc5987(nombre)}`,
        'Content-Length': String(archivo.DATOS_ARCHIVO.byteLength),
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[GET /api/archivos] Error al recuperar archivo:', error instanceof Error ? error.name : 'Error')
    return NextResponse.json({ error: 'No se pudo recuperar el archivo.' }, { status: 500 })
  }
}
