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
import { calcFechaEstimada, calcEdadActual } from '@/lib/bulk-sync/processors'
import type { AnalysisResult, CommitApiResponse } from '@/lib/bulk-sync/types'
import {
  calcAntiguedadRecibo,
  calcAntiguedadLicencias,
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
        // ────────────────────────────────────────────────────────────────────
        for (const row of dp.nuevas) {
          const fechaNac = new Date(row.fechaNacimientoISO)

          // Calcular campos derivados
          let fechaEstimada: Date | null = null
          let edadActual: number | null = null
          if (row.idRegimen) {
            // Obtener EDAD_REQUERIDA para calcular fecha estimada
            const regimen = await tx.rEGIMEN_JUBILATORIO.findUnique({
              where: { ID_REGIMEN_JUBILATORIO: row.idRegimen },
              select: { EDAD_REQUERIDA: true },
            })
            if (regimen) {
              fechaEstimada = calcFechaEstimada(fechaNac, regimen.EDAD_REQUERIDA)
              edadActual = calcEdadActual(fechaNac)
            }
          }

          await tx.dATOS_PERSONALES_AGENTE_JUBILA.create({
            data: {
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
              FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: fechaEstimada,
              EDAD_ESTIMACION_JUBILACION: edadActual,
              ANTIGUEDAD_RECIBO_CALC: '0 Años, 0 Meses, 0 Días',
              ANTIGUEDAD_LICENCIAS_CALC: '0 Años, 0 Meses, 0 Días',
            },
          })
          dpInsertados++
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 2: Actualizar agentes existentes en DATOS_PERSONALES_AGENTE_JUBILA
        // Los campos derivados se recalculan para todos al finalizar la carga.
        // ────────────────────────────────────────────────────────────────────
        for (const row of dp.actualizadas) {
          const fechaNac = new Date(row.payload.FECHA_NACIMIENTO)

          // Recalcular campos derivados si cambió régimen o fecha de nacimiento
          let fechaEstimada: Date | undefined = undefined
          let edadActual: number | undefined = undefined
          const regimenCambio = row.diffs.some((d) => d.campo === 'REGIMEN_JUBILATORIO')
          const fechaNacCambio = row.diffs.some((d) => d.campo === 'FECHA_NACIMIENTO')

          if (regimenCambio || fechaNacCambio) {
            if (row.payload.ID_REGIMEN_JUBILATORIO) {
              const regimen = await tx.rEGIMEN_JUBILATORIO.findUnique({
                where: { ID_REGIMEN_JUBILATORIO: row.payload.ID_REGIMEN_JUBILATORIO },
                select: { EDAD_REQUERIDA: true },
              })
              if (regimen) {
                fechaEstimada = calcFechaEstimada(fechaNac, regimen.EDAD_REQUERIDA)
                edadActual = calcEdadActual(fechaNac)
              }
            }
          }

          // Construir payload de update con solo los campos que cambiaron
          // + campos derivados si corresponde
          // NUNCA incluir ANTIGUEDAD_RECIBO, ANTIGUEDAD_LICENCIAS en este UPDATE
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
              ...(fechaEstimada !== undefined && {
                FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: fechaEstimada,
                EDAD_ESTIMACION_JUBILACION: edadActual ?? null,
              }),
            },
          })
          dpActualizados++
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 3: Insertar nuevas fases en CARRERA_ADMINISTRATIVA
        // ────────────────────────────────────────────────────────────────────
        for (const row of ca.nuevas) {
          await tx.cARRERA_ADMINISTRATIVA.create({
            data: {
              DOCUMENTO_EMPLEADO: row.dni,
              FECHA_ALTA: new Date(row.fechaAltaISO),
              FECHA_BAJA: row.fechaBajaISO ? new Date(row.fechaBajaISO) : null,
              CAUSA_BAJA: row.causaBaja,
              // FECHA_CREACION tiene DEFAULT NOW() en la DB
            },
          })
          caInsertadas++
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
        timeout: 90_000, // 90 segundos máximo para la transacción
      },
    )

    // ── Post-commit: recalcular y persistir derivados para TODOS ─────────────
    // Se ejecuta después de insertar las fases para que la antigüedad incluya
    // también las nuevas carreras de esta importación.
    await recalcularDerivadosDeTodosLosAgentes()

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

async function recalcularDerivadosDeTodosLosAgentes(): Promise<void> {
  const agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
    include: {
      REGIMEN_JUBILATORIO: true,
      CARRERA_ADMINISTRATIVA: { orderBy: { FECHA_ALTA: 'asc' } },
    },
  })

  for (const agente of agentes) {
    const fechaNacimiento = new Date(agente.FECHA_NACIMIENTO)
    const edadActual = calcEdadActual(fechaNacimiento)
    const fechaEstimada = agente.REGIMEN_JUBILATORIO
      ? calcFechaEstimada(fechaNacimiento, agente.REGIMEN_JUBILATORIO.EDAD_REQUERIDA)
      : null

    const fases: FaseCarrera[] = (agente.CARRERA_ADMINISTRATIVA ?? []).map((f) => ({
      FECHA_ALTA: f.FECHA_ALTA,
      FECHA_BAJA: f.FECHA_BAJA,
    }))

    const antiguedadRecibo = calcAntiguedadRecibo(fases, fechaEstimada)
    const antiguedadLicencias = calcAntiguedadLicencias(fases, fechaEstimada)

    await prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({
      where: { ID_DATOS_PERSONALES_AGENTE_JUBILA: agente.ID_DATOS_PERSONALES_AGENTE_JUBILA },
      data: {
        FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: fechaEstimada,
        EDAD_ESTIMACION_JUBILACION: edadActual,
        ANTIGUEDAD_RECIBO_CALC: antiguedadRecibo,
        ANTIGUEDAD_LICENCIAS_CALC: antiguedadLicencias,
      },
    })
  }
}
