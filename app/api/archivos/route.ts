import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/archivos?id=<ID_ARCHIVO>
 * Retorna el buffer del archivo como respuesta binaria con el Content-Type correcto.
 * Esta ruta se usa para abrir el visor in-app sin descargar el archivo.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const idStr = searchParams.get('id')

  if (!idStr || isNaN(Number(idStr))) {
    return NextResponse.json({ error: 'ID de archivo inválido.' }, { status: 400 })
  }

  try {
    const archivo = await prisma.aRCHIVO_JUBILACION.findUnique({
      where: { ID_ARCHIVO: Number(idStr) },
      select: {
        DATOS_ARCHIVO: true,
        NOMBRE_ARCHIVO: true,
        TIPO_ARCHIVO: true,
      },
    })

    if (!archivo) {
      return NextResponse.json({ error: 'Archivo no encontrado.' }, { status: 404 })
    }

    const contentType = archivo.TIPO_ARCHIVO || 'application/octet-stream'

    return new NextResponse(archivo.DATOS_ARCHIVO, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // inline = visualizar en el navegador, no descargar
        'Content-Disposition': `inline; filename="${encodeURIComponent(archivo.NOMBRE_ARCHIVO)}"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (error) {
    console.error('[GET /api/archivos] Error:', error)
    return NextResponse.json({ error: 'Error al recuperar el archivo.' }, { status: 500 })
  }
}
