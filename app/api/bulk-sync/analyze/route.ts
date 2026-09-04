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
 *   - datosPersonales: archivo Excel
 *   - carreraAdministrativa: archivo Excel
 */

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

export const runtime = 'nodejs'
// Los archivos Excel pueden ser grandes; aumentar el límite de body
export const maxDuration = 60

export async function POST(request: NextRequest): Promise<NextResponse<AnalyzeApiResponse>> {
  try {
    // ── 1. Leer archivos del form ─────────────────────────────────────────────
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
    const dpMeta = validateFileMetadata(dpFile.name, dpFile.size)
    if (!dpMeta.ok) {
      return NextResponse.json({ ok: false, error: dpMeta.error }, { status: 400 })
    }
    const caMeta = validateFileMetadata(caFile.name, caFile.size)
    if (!caMeta.ok) {
      return NextResponse.json({ ok: false, error: caMeta.error }, { status: 400 })
    }

    // ── 3. Leer buffers y parsear Excel ───────────────────────────────────────
    const [dpBuffer, caBuffer] = await Promise.all([
      dpFile.arrayBuffer().then((ab) => Buffer.from(ab)),
      caFile.arrayBuffer().then((ab) => Buffer.from(ab)),
    ])

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

    const caAnalysis = analyzeCarreraAdministrativa(caParsed.rows, fasesMap, dnisConocidos)

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

    return NextResponse.json({ ok: true, analysis })
  } catch (err) {
    console.error('[bulk-sync/analyze] Error inesperado:', err)
    return NextResponse.json(
      { ok: false, error: 'Error interno del servidor. Por favor contacte al administrador.' },
      { status: 500 },
    )
  }
}
