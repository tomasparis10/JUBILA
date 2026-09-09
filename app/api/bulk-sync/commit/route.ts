/**
 * app/api/bulk-sync/commit/route.ts
 *
 * Endpoint de COMMIT: recibe el resultado del análisis aprobado por el usuario
 * y ejecuta los INSERT/UPDATE dentro de una transacción Prisma.
 *
 * GARANTÍAS:
 * - Todo o nada: si falla alguna operación → ROLLBACK automático
 * - NO borra registros
 * - Recalcula y persiste los campos derivados para todos los agentes
 * - Ejecuta primero Datos Personales, luego Carrera Administrativa
 *
 * Método: POST
 * Body: JSON con AnalysisResult
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { calcEdadActual } from '@/lib/bulk-sync/processors'
import type { AnalysisResult, CommitApiResponse } from '@/lib/bulk-sync/types'
import { getAuthenticatedSession } from '@/lib/auth-session'
import {
  calcAntiguedadRecibo,
  calcAntiguedadLicencias,
  calcEdadEnFecha,
  calcFechaEstimadaJubilacion,
  type FaseCarrera,
} from '@/utils/calculosPrevisionales'

export const runtime = 'nodejs'
export const maxDuration = 120

// Flag en memoria para prevenir doble ejecución accidental
let isRunning = false

function nowStr(): string {
  const now = new Date()
  const dd = String(now.getDate()).padStart(2, '0')
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const hh = String(now.getHours()).padStart(2, '0')
  const min = String(now.getMinutes()).padStart(2, '0')
  return `${dd}/${mm}/${now.getFullYear()} ${hh}:${min}`
}

export async function POST(request: NextRequest): Promise<NextResponse<CommitApiResponse>> {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Sesión inválida o vencida.' }, { status: 401 })
  }

  // ── Prevenir doble ejecución ────────────────────────────────────────────────
  if (isRunning) {
    return NextResponse.json(
      { ok: false, error: 'Ya hay una actualización en curso. Esperá a que termine.' },
      { status: 409 },
    )
  }

  isRunning = true
  try {
    // ── Leer análisis del body ──────────────────────────────────────────────
    let analysis: AnalysisResult
    try {
      analysis = (await request.json()) as AnalysisResult
    } catch {
      return NextResponse.json({ ok: false, error: 'Body inválido.' }, { status: 400 })
    }

    if (!analysis?.datosPersonales || !analysis?.carreraAdministrativa) {
      return NextResponse.json({ ok: false, error: 'Análisis inválido o incompleto.' }, { status: 400 })
    }

    // ── Rechazar si hay errores críticos ────────────────────────────────────
    if (analysis.tieneErroresCriticos) {
      return NextResponse.json(
        { ok: false, error: 'El análisis contiene errores críticos. Corregí los archivos antes de confirmar.' },
        { status: 400 },
      )
    }

    const { datosPersonales: dp, carreraAdministrativa: ca } = analysis

    // Contadores finales
    let dpInsertados = 0
    let dpActualizados = 0
    let dpSinCambios = dp.sinCambios
    let dpErrores = 0
    let caInsertadas = 0
    let caActualizadas = 0
    let caSinCambios = ca.sinCambios
    let caErrores = 0

    // ── Transacción principal ───────────────────────────────────────────────
    await prisma.$transaction(
      async (tx) => {
        // ────────────────────────────────────────────────────────────────────
        // PASO 1: Insertar nuevos agentes en DATOS_PERSONALES_AGENTE_JUBILA
        // (batch: createMany en lugar de insert 1x1)
        // ────────────────────────────────────────────────────────────────────
        if (dp.nuevas.length > 0) {
          const nuevosData = dp.nuevas.map((row) => {
            const fechaNac = new Date(row.fechaNacimientoISO)
            return {
              // El schema permite NULL para conservar filas sin DNI.
              DNI_AGENTE: row.dni as string,
              NOMBRE_AGENTE: row.nombre,
              APELLIDO_AGENTE: row.apellido,
              FECHA_NACIMIENTO: fechaNac,
              SECRETARIA: row.secretaria || null,
              PROGRAMA: row.programa || null,
              CARGO: row.cargo || null,
              SEXO: row.sexo || null,
              ESTADO_ACTIVO: row.estadoActivo,
              CUIL: row.cuil || null,
              NUMERO_TELEFONO: row.telefono || null,
              CORREO_ELECTRONICO: row.correo || null,
              ID_REGIMEN_JUBILATORIO: row.idRegimen,
              // Los derivados se recalculan al finalizar la carga (post-commit)
              FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: null,
              EDAD_ESTIMACION_JUBILACION: row.idRegimen ? calcEdadActual(fechaNac) : null,
              ANTIGUEDAD_RECIBO_CALC: '0 Años, 0 Meses, 0 Días',
              ANTIGUEDAD_LICENCIAS_CALC: '0 Años, 0 Meses, 0 Días',
              FECHA_INICIO_CREACION_DATOS_PERSONALES: new Date(),
              USUARIO_CREACION: session.userId,
              FECHA_ULTIMA_MODIFICACION: new Date(),
              USUARIO_ULTIMA_MODIFICACION: session.userId,
            }
          })
          await tx.dATOS_PERSONALES_AGENTE_JUBILA.createMany({ data: nuevosData })
          dpInsertados = nuevosData.length
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 2: Actualizar agentes existentes en DATOS_PERSONALES_AGENTE_JUBILA
        // Los campos derivados se recalculan para todos al finalizar la carga.
        // ────────────────────────────────────────────────────────────────────
        // PASO 2: Actualizar agentes existentes en DATOS_PERSONALES_AGENTE_JUBILA
        // Los derivados (edad estimada, fecha estimada, antigüedades) se recalculan
        // para TODOS en el post-commit, por lo que aquí no se consulta el régimen
        // (elimina el findUnique 1x1 por fila, fuente del cuello de botella).
        for (const row of dp.actualizadas) {
          const fechaNac = new Date(row.payload.FECHA_NACIMIENTO)

          await tx.dATOS_PERSONALES_AGENTE_JUBILA.update({
            where: { DNI_AGENTE: row.dni },
            data: {
              NOMBRE_AGENTE: row.payload.NOMBRE_AGENTE,
              APELLIDO_AGENTE: row.payload.APELLIDO_AGENTE,
              FECHA_NACIMIENTO: fechaNac,
              SECRETARIA: row.payload.SECRETARIA,
              PROGRAMA: row.payload.PROGRAMA,
              CARGO: row.payload.CARGO,
              SEXO: row.payload.SEXO,
              ESTADO_ACTIVO: row.payload.ESTADO_ACTIVO,
              CUIL: row.payload.CUIL,
              NUMERO_TELEFONO: row.payload.NUMERO_TELEFONO,
              CORREO_ELECTRONICO: row.payload.CORREO_ELECTRONICO,
              ID_REGIMEN_JUBILATORIO: row.payload.ID_REGIMEN_JUBILATORIO,
              FECHA_ULTIMA_MODIFICACION: new Date(),
              USUARIO_ULTIMA_MODIFICACION: session.userId,
            },
          })
          dpActualizados++
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 3: Insertar nuevas fases en CARRERA_ADMINISTRATIVA
        // (batch: createMany)
        // ────────────────────────────────────────────────────────────────────
        if (ca.nuevas.length > 0) {
          await tx.cARRERA_ADMINISTRATIVA.createMany({
            data: ca.nuevas.map((row) => ({
              DOCUMENTO_EMPLEADO: row.dni,
              FECHA_ALTA: new Date(row.fechaAltaISO),
              FECHA_BAJA: row.fechaBajaISO ? new Date(row.fechaBajaISO) : null,
              CAUSA_BAJA: row.causaBaja,
              // FECHA_CREACION tiene DEFAULT NOW() en la DB
            })),
          })
          caInsertadas = ca.nuevas.length
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 4: Actualizar fases existentes en CARRERA_ADMINISTRATIVA
        // IDENTIFICAR SIEMPRE por ID_CARRERA (nunca solo por DNI)
        // NUNCA tocar FECHA_CREACION de fases existentes
        // ────────────────────────────────────────────────────────────────────
        for (const row of ca.actualizadas) {
          await tx.cARRERA_ADMINISTRATIVA.update({
            where: { ID_CARRERA: row.idCarrera },
            data: {
              FECHA_BAJA: row.payload.FECHA_BAJA ? new Date(row.payload.FECHA_BAJA) : null,
              CAUSA_BAJA: row.payload.CAUSA_BAJA,
              // NO modificar: FECHA_ALTA, DOCUMENTO_EMPLEADO, FECHA_CREACION
            },
          })
          caActualizadas++
        }
      },
      {
        timeout: 300_000, // 5 minutos máximo para la transacción de escritura
      },
    )

    // ── Post-commit: recalcular y persistir derivados para TODOS ─────────────
    // Se ejecuta después de insertar las fases para que la antigüedad incluya
    // también las nuevas carreras de esta importación.
    await recalcularDerivadosDeTodosLosAgentes(session.userId)

    return NextResponse.json({
      ok: true,
      lastUpdated: nowStr(),
      datosPersonales: {
        insertados: dpInsertados,
        actualizados: dpActualizados,
        sinCambios: dpSinCambios,
        errores: dpErrores,
      },
      carreraAdministrativa: {
        insertadas: caInsertadas,
        actualizadas: caActualizadas,
        sinCambios: caSinCambios,
        errores: caErrores,
      },
    })
  } catch (err) {
    console.error('[bulk-sync/commit] Error — ROLLBACK ejecutado:', err)
    return NextResponse.json(
      {
        ok: false,
        error:
          'Error durante la actualización. Se revirtieron todos los cambios. Por favor intentá nuevamente.',
      },
      { status: 500 },
    )
  } finally {
    isRunning = false
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers: recalcular y persistir todos los campos derivados
// ─────────────────────────────────────────────────────────────────────────────

async function recalcularDerivadosDeTodosLosAgentes(usuarioId: number): Promise<void> {
  const agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
    include: {
      REGIMEN_JUBILATORIO: true,
      CARRERA_ADMINISTRATIVA: { orderBy: { FECHA_ALTA: 'asc' } },
    },
  })

  const updates: Promise<unknown>[] = []

  for (const agente of agentes) {
    const fechaNacimiento = new Date(agente.FECHA_NACIMIENTO)
    const fases: FaseCarrera[] = (agente.CARRERA_ADMINISTRATIVA ?? []).map((f) => ({
      FECHA_ALTA: f.FECHA_ALTA,
      FECHA_BAJA: f.FECHA_BAJA,
    }))

    const fechaEstimada = agente.REGIMEN_JUBILATORIO
      ? calcFechaEstimadaJubilacion(
          fechaNacimiento,
          agente.REGIMEN_JUBILATORIO.EDAD_REQUERIDA,
          agente.REGIMEN_JUBILATORIO.ANOS_APORTES_REQUERIDOS,
          fases,
        )
      : null
    const edadEstimada = fechaEstimada
      ? calcEdadEnFecha(fechaNacimiento, fechaEstimada)
      : null

    const antiguedadRecibo = calcAntiguedadRecibo(fases)
    const antiguedadLicencias = calcAntiguedadLicencias(fases, fechaEstimada)

    updates.push(
      prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({
        where: { ID_DATOS_PERSONALES_AGENTE_JUBILA: agente.ID_DATOS_PERSONALES_AGENTE_JUBILA },
        data: {
          FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: fechaEstimada,
          EDAD_ESTIMACION_JUBILACION: edadEstimada,
          ANTIGUEDAD_RECIBO_CALC: antiguedadRecibo,
          ANTIGUEDAD_LICENCIAS_CALC: antiguedadLicencias,
          FECHA_ULTIMA_MODIFICACION: new Date(),
          USUARIO_ULTIMA_MODIFICACION: usuarioId,
        },
      }),
    )
  }

  // Ejecutar por lotes concurrentes (el pool de Prisma acota la concurrencia)
  // en lugar de 1 update secuencial por agente.
  const TAMANIO_LOTE = 200
  for (let i = 0; i < updates.length; i += TAMANIO_LOTE) {
    await Promise.all(updates.slice(i, i + TAMANIO_LOTE))
  }
}
