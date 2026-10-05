/**
 * app/api/bulk-sync/analyze/route.ts
 *
 * Endpoint de ANÁLISIS: recibe los dos archivos Excel vía multipart/form-data,
 * valida, compara con la DB y devuelve las operaciones pendientes.
 *
 * NO ESCRIBE NADA EN LA BASE DE DATOS.
 *
 * Método: POST
 * Body: multipart/form-data con campos:
 *   - datosPersonales: archivo Excel (opcionalmente .gz)
 *   - carreraAdministrativa: archivo Excel (opcionalmente .gz)
 *
 * Los exportes de Raet con 32k agentes pesan 8,1 MB + 4,7 MB, y Vercel corta
 * cualquier request con body mayor a 4,5 MB (413) antes de que la función
 * corra. Por eso el panel los manda comprimidos con gzip (1,2 MB + 0,5 MB) y
 * acá se descomprime antes de parsear.
 */

import { gunzipSync } from 'node:zlib'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  validateFileMetadata,
  readExcelBuffer,
  validateDatosPersonalesColumns,
  validateCarreraColumns,
} from '@/lib/bulk-sync/validators'
import {
  analyzeDatosPersonales,
  analyzeCarreraAdministrativa,
} from '@/lib/bulk-sync/processors'
import { dateToStr } from '@/lib/bulk-sync/normalizers'
import type {
  AgenteExistente,
  FaseExistente,
  AnalysisResult,
  AnalyzeApiResponse,
} from '@/lib/bulk-sync/types'
import { getAuthenticatedSession } from '@/lib/auth-session'

export const runtime = 'nodejs'
// Los archivos Excel pueden ser grandes (32k agentes): el análisis completo
// tarda más de 60s, y con el límite default de Vercel la función se cortaba a
// los 60 segundos y el panel mostraba "Error inesperado al conectar con el
// servidor". Mismo límite que el commit.
export const maxDuration = 300

/** Límite de body de Vercel: cualquier request más grande se rechaza con 413. */
const LIMITE_BODY_VERCEL = 4.5 * 1024 * 1024

/**
 * Lee un archivo del multipart. Si viene comprimido con gzip (el panel los
 * manda así para no pasar el límite de 4,5 MB de Vercel) lo descomprime y
 * devuelve el nombre original sin la extensión .gz, que es el que usan los
 * validadores para decidir cómo parsear.
 */
/** Error de validación del request: se devuelve el mensaje al panel, no 500. */
class RequestInvalidoError extends Error {}

/** Quita la extensión .gz con la que el panel manda los archivos comprimidos. */
function nombreOriginal(nombre: string): string {
  return nombre.toLowerCase().endsWith('.gz') ? nombre.slice(0, -3) : nombre
}

async function leerArchivo(file: File): Promise<{ buffer: Buffer; nombre: string }> {
  const comprimido = file.name.toLowerCase().endsWith('.gz')
  const nombre = nombreOriginal(file.name)

  // Si llega sin comprimir y supera el límite, es un 413 garantizado: mejor
  // un error claro en el panel que un fallo genérico de conexión.
  if (!comprimido && file.size > LIMITE_BODY_VERCEL) {
    throw new RequestInvalidoError(
      `El archivo "${file.name}" pesa ${(file.size / 1024 / 1024).toFixed(1)} MB y supera el límite de 4,5 MB por request. ` +
        'Volvé a seleccionar el archivo para que se comprima automáticamente.',
    )
  }

  const original = Buffer.from(await file.arrayBuffer())
  return { buffer: comprimido ? gunzipSync(original) : original, nombre }
}

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeApiResponse>> {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Sesión inválida o vencida.' }, { status: 401 })
  }
  if (session.role !== 'ADMIN') {
    return NextResponse.json({ ok: false, error: 'No autorizado. La carga masiva requiere rol ADMIN.' }, { status: 403 })
  }

  try {
    // ── 1. Leer archivos del form ─────────────────────────────────────────────
    // Tiempos por etapa: con exports de 32k agentes es la única forma de saber
    // dónde se va el tiempo cuando el análisis tarda (y se acerca al límite de
    // la función en Vercel). Son acumulados desde el inicio de la request.
    const t0 = Date.now()
    const tiempos: Record<string, number> = {}
    const marcar = (etapa: string) => {
      tiempos[etapa] = Date.now() - t0
    }

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ ok: false, error: 'No se pudo leer el formulario multipart.' }, { status: 400 })
    }

    const dpFile = formData.get('datosPersonales')
    const caFile = formData.get('carreraAdministrativa')

    if (!(dpFile instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Falta el archivo de Datos Personales.' }, { status: 400 })
    }
    if (!(caFile instanceof File)) {
      return NextResponse.json({ ok: false, error: 'Falta el archivo de Carrera Administrativa.' }, { status: 400 })
    }

    // ── 2. Validar metadatos de archivos ──────────────────────────────────────
    // Con la extensión .gz (que es como los manda el panel) los validadores
    // rechazan la extensión, así que se valida contra el nombre sin comprimir.
    const dpNombre = nombreOriginal(dpFile.name)
    const caNombre = nombreOriginal(caFile.name)
    const dpMeta = validateFileMetadata(dpNombre, dpFile.size)
    if (!dpMeta.ok) {
      return NextResponse.json({ ok: false, error: dpMeta.error }, { status: 400 })
    }
    const caMeta = validateFileMetadata(caNombre, caFile.size)
    if (!caMeta.ok) {
      return NextResponse.json({ ok: false, error: caMeta.error }, { status: 400 })
    }

    // ── 3. Leer buffers (descomprimiendo gzip si viene) y parsear Excel ───────
    const [dpBuffer, caBuffer] = await Promise.all([
      leerArchivo(dpFile).then((r) => r.buffer),
      leerArchivo(caFile).then((r) => r.buffer),
    ])

    marcar('form')
    const dpParsed = readExcelBuffer(dpBuffer)
    if (!dpParsed.ok) {
      return NextResponse.json({ ok: false, error: `Datos Personales: ${dpParsed.error}` }, { status: 400 })
    }

    const caParsed = readExcelBuffer(caBuffer)
    if (!caParsed.ok) {
      return NextResponse.json({ ok: false, error: `Carrera Administrativa: ${caParsed.error}` }, { status: 400 })
    }

    // ── 4. Validar columnas ───────────────────────────────────────────────────
    const dpColVal = validateDatosPersonalesColumns(dpParsed.headers)
    if (!dpColVal.ok) {
      return NextResponse.json({
        ok: false,
        error: `Datos Personales: columnas faltantes: ${dpColVal.missing.join(', ')}`,
        validationErrors: dpColVal.missing.map((c) => `Columna faltante en DatosPersonales.xlsx: "${c}"`),
      }, { status: 400 })
    }

    marcar('leerExcel')
    const caColVal = validateCarreraColumns(caParsed.headers)
    if (!caColVal.ok) {
      return NextResponse.json({
        ok: false,
        error: `Carrera Administrativa: columnas faltantes: ${caColVal.missing.join(', ')}`,
        validationErrors: caColVal.missing.map((c) => `Columna faltante en CarreraAdministrativa.xlsx: "${c}"`),
      }, { status: 400 })
    }

    // ── 5. Cargar datos de la DB en lote (NO query por fila) ──────────────────
    const [regimenes, agentesDB, fasesDB] = await Promise.all([
      prisma.rEGIMEN_JUBILATORIO.findMany({
        select: {
          ID_REGIMEN_JUBILATORIO: true,
          NOMBRE_REGIMEN: true,
          SEXO: true,
          EDAD_REQUERIDA: true,
        },
      }),
      prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
        select: {
          DNI_AGENTE: true,
          ID_REGIMEN_JUBILATORIO: true,
          NOMBRE_AGENTE: true,
          APELLIDO_AGENTE: true,
          SEGUNDO_NOMBRE_AGENTE: true,
          SEGUNDO_APELLIDO_AGENTE: true,
          FECHA_NACIMIENTO: true,
          SECRETARIA: true,
          PROGRAMA: true,
          CARGO: true,
          SEXO: true,
          ESTADO_ACTIVO: true,
          CUIL: true,
          NUMERO_TELEFONO: true,
          CORREO_ELECTRONICO: true,
        },
      }),
      prisma.cARRERA_ADMINISTRATIVA.findMany({
        select: {
          ID_CARRERA: true,
          DOCUMENTO_EMPLEADO: true,
          FECHA_ALTA: true,
          FECHA_BAJA: true,
          CAUSA_BAJA: true,
        },
      }),
    ])

    marcar('db')
    // Construir Maps para búsqueda O(1)
    const agentesMap = new Map<string, AgenteExistente>(
      agentesDB
        .filter((a): a is typeof a & { DNI_AGENTE: string } => a.DNI_AGENTE !== null)
        .map((a) => [a.DNI_AGENTE, a as AgenteExistente]),
    )

    const fasesMap = new Map<string, FaseExistente[]>()
    for (const f of fasesDB) {
      const clave = `${f.DOCUMENTO_EMPLEADO}|${dateToStr(f.FECHA_ALTA)}`
      const candidatas = fasesMap.get(clave) ?? []
      candidatas.push(f as FaseExistente)
      fasesMap.set(clave, candidatas)
    }

    const dnisConocidos = new Set(
      agentesDB.flatMap((a) => (a.DNI_AGENTE ? [a.DNI_AGENTE] : [])),
    )

    // ── 6. Analizar en memoria ────────────────────────────────────────────────
    const dpAnalysis = analyzeDatosPersonales(dpParsed.rows, regimenes, agentesMap)

    // Los DNIs nuevos detectados en DP también son "conocidos" para CA
    // (serán insertados en el commit antes de CA)
    for (const nuevo of dpAnalysis.nuevas) {
      if (nuevo.dni) dnisConocidos.add(nuevo.dni)
    }

    marcar('analizarDP')
    const caAnalysis = analyzeCarreraAdministrativa(caParsed.rows, fasesMap, dnisConocidos)
    marcar('analizarCA')

    // ── 7. Construir resultado ────────────────────────────────────────────────
    const tieneErroresCriticos =
      dpAnalysis.errores.length > 0 || caAnalysis.errores.length > 0

    const analysis: AnalysisResult = {
      datosPersonales: {
        nuevas: dpAnalysis.nuevas,
        actualizadas: dpAnalysis.actualizadas,
        sinCambios: dpAnalysis.sinCambios,
        errores: dpAnalysis.errores,
        omitidas: dpAnalysis.omitidas,
        sinDni: dpAnalysis.sinDni,
      },
      carreraAdministrativa: {
        nuevas: caAnalysis.nuevas,
        actualizadas: caAnalysis.actualizadas,
        sinCambios: caAnalysis.sinCambios,
        errores: caAnalysis.errores,
        ignoradas: caAnalysis.ignoradas,
        noEncontradas: caAnalysis.noEncontradas,
      },
      tieneErroresCriticos,
    }

    console.log('[bulk-sync/analyze] tiempos(ms):', JSON.stringify(tiempos), 'filasDP=' + dpParsed.rows.length, 'filasCA=' + caParsed.rows.length)
    return NextResponse.json({ ok: true, analysis })
  } catch (err) {
    if (err instanceof RequestInvalidoError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 413 })
    }
    console.error('[bulk-sync/analyze] Error inesperado:', err)
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor. Por favor contacte al administrador.' },
      { status: 500 },
    )
  }
}
