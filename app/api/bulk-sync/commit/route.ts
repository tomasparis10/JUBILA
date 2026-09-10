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
import { Prisma } from '@prisma/client'
import { calcEdadActual } from '@/lib/bulk-sync/processors'
import type {
  AnalysisResult,
  CommitApiResponse,
  DpRowActualizada,
  CaRowActualizada,
} from '@/lib/bulk-sync/types'
import type { Prisma as PrismaClientNS } from '@prisma/client'
import { getAuthenticatedSession } from '@/lib/auth-session'
import {
  calcAntiguedadRecibo,
  calcAntiguedadLicencias,
  calcEdadEnFecha,
  calcFechaEstimadaJubilacion,
  type FaseCarrera,
} from '@/utils/calculosPrevisionales'

export const runtime = 'nodejs'
export const maxDuration = 300

// Filas por sentencia SQL en la actualización masiva.
// SQL Server limita a 2100 parámetros por sentencia:
//   - DP: 13 columnas + 1 parámetro → 150 filas = 1951 parámetros
//   - CA: 3 columnas → 450 filas = 1350 parámetros
// Cuantas menos sentencias, menos round-trips contra la DB (la transacción
// interactiva de Prisma serializa todas las operaciones en UNA sola conexión).
const FILAS_SQL_DP = 150
const FILAS_SQL_CA = 450

// Concurrencia acotada para el recálculo de derivados (post-commit).
const CONCURRENCIA_RECALCULO = 50

/** Divide un array en lotes de tamaño `size`. */
function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

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
  // Fase actual para mensajes de error honestos (#1 transacción con rollback real,
  // #2 recálculo post-commit donde los cambios YA quedaron guardados).
  let faseActual: 'transaccion' | 'recalculo' = 'transaccion'
  const t0 = Date.now()
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

    // ── Transacción principal (forma arreglo) ───────────────────────────────
    // OJO: en SQL Server los $executeRaw DENTRO de prisma.$transaction(async
    // tx => ...) NO corren sobre la conexión de la transacción (evidencia
    // empírica: "Invalid object name '#tmp_dp'": cada ejecución raw usó otra
    // conexión del pool y las temp tables son por-sesión). La forma arreglo
    // $transaction([...]) envuelve TODAS las operaciones (incluidas las raw) en
    // UNA sola transacción real, con rollback íntegro. Cada sentencia lleva su
    // propia data (no hay estado entre statements, así que no hacen falta temp
    // tables).
    const operaciones: Prisma.PrismaPromise<unknown>[] = []
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
          operaciones.push(
            prisma.dATOS_PERSONALES_AGENTE_JUBILA.createMany({ data: nuevosData }),
          )
          dpInsertados = nuevosData.length
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 2: Actualizar agentes existentes en DATOS_PERSONALES_AGENTE_JUBILA
        // UPDATE MASIVO con CAST explícito por columna (anula la inferencia de
        // tipos de SQL Server sobre VALUES, que con NULLs asumía `int` → P2010
        // code 245). Una sentencia por lote; todas dentro de la $transaction
        // arreglo → rollback íntegro ante cualquier fallo.
        // FECHAS: se pasan como texto plano 'yyyy-mm-dd' (partes UTC), sin objeto
        // Date ni instante → SQL Server guarda literalmente la fecha del Excel,
        // sin conversión por zona horaria.
        // ────────────────────────────────────────────────────────────────────
        const filasDp = dp.actualizadas.map((row) => ({
          dni: row.dni,
          nombre: row.payload.NOMBRE_AGENTE,
          apellido: row.payload.APELLIDO_AGENTE,
          // Fecha con formato plano 'yyyy-mm-dd' (partes UTC): nunca se convierte
          // por zona horaria ni depende de cómo SQL Server enlaza un Date.
          fechaNac: row.payload.FECHA_NACIMIENTO.slice(0, 10),
          secretaria: row.payload.SECRETARIA ?? null,
          programa: row.payload.PROGRAMA ?? null,
          cargo: row.payload.CARGO ?? null,
          sexo: row.payload.SEXO ?? null,
          estado: row.payload.ESTADO_ACTIVO,
          cuil: row.payload.CUIL ?? null,
          telefono: row.payload.NUMERO_TELEFONO ?? null,
          correo: row.payload.CORREO_ELECTRONICO ?? null,
          idRegimen: row.payload.ID_REGIMEN_JUBILATORIO ?? null,
        }))

        if (filasDp.length > 0) {
          for (const lote of chunk(filasDp, FILAS_SQL_DP)) {
            operaciones.push(
              prisma.$executeRaw(Prisma.sql`
                UPDATE dATOS_PERSONALES_AGENTE_JUBILA
                SET
                  NOMBRE_AGENTE = v.nombre,
                  APELLIDO_AGENTE = v.apellido,
                  FECHA_NACIMIENTO = v.fechaNac,
                  SECRETARIA = v.secretaria,
                  PROGRAMA = v.programa,
                  CARGO = v.cargo,
                  SEXO = v.sexo,
                  ESTADO_ACTIVO = v.estado,
                  CUIL = v.cuil,
                  NUMERO_TELEFONO = v.telefono,
                  CORREO_ELECTRONICO = v.correo,
                  ID_REGIMEN_JUBILATORIO = v.idRegimen,
                  FECHA_ULTIMA_MODIFICACION = GETDATE(),
                  USUARIO_ULTIMA_MODIFICACION = ${session.userId}
                FROM (
                  VALUES ${Prisma.join(
                    lote.map(
                      (f) => Prisma.sql`(
                        CAST(${f.dni} AS NVARCHAR(50)),
                        CAST(${f.nombre} AS NVARCHAR(255)),
                        CAST(${f.apellido} AS NVARCHAR(255)),
                        CAST(${f.fechaNac} AS DATE),
                        CAST(${f.secretaria} AS NVARCHAR(255)),
                        CAST(${f.programa} AS NVARCHAR(255)),
                        CAST(${f.cargo} AS NVARCHAR(255)),
                        CAST(${f.sexo} AS NVARCHAR(50)),
                        CAST(${f.estado} AS BIT),
                        CAST(${f.cuil} AS NVARCHAR(20)),
                        CAST(${f.telefono} AS NVARCHAR(50)),
                        CAST(${f.correo} AS NVARCHAR(255)),
                        CAST(${f.idRegimen} AS INT)
                      )`,
                    ),
                    ',',
                  )}
                ) AS v(dni, nombre, apellido, fechaNac, secretaria, programa, cargo, sexo, estado, cuil, telefono, correo, idRegimen)
                WHERE dATOS_PERSONALES_AGENTE_JUBILA.DNI_AGENTE = v.dni
              `),
            )
          }
          dpActualizados = filasDp.length
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 3: Insertar nuevas fases en CARRERA_ADMINISTRATIVA
        // (batch: createMany)
        // ────────────────────────────────────────────────────────────────────
        if (ca.nuevas.length > 0) {
          operaciones.push(
            prisma.cARRERA_ADMINISTRATIVA.createMany({
              data: ca.nuevas.map((row) => ({
                DOCUMENTO_EMPLEADO: row.dni,
                FECHA_ALTA: new Date(row.fechaAltaISO),
                FECHA_BAJA: row.fechaBajaISO ? new Date(row.fechaBajaISO) : null,
                CAUSA_BAJA: row.causaBaja,
                // FECHA_CREACION tiene DEFAULT NOW() en la DB
              })),
            }),
          )
          caInsertadas = ca.nuevas.length
        }

        // ────────────────────────────────────────────────────────────────────
        // PASO 4: Actualizar fases existentes en CARRERA_ADMINISTRATIVA
        // IDENTIFICAR SIEMPRE por ID_CARRERA (nunca solo por DNI)
        // NUNCA tocar FECHA_CREACION de fases existentes.
        // UPDATE MASIVO con CAST explícito (misma técnica que PASO 2).
        // ────────────────────────────────────────────────────────────────────
        const filasCa = ca.actualizadas.map((row) => ({
          id: row.idCarrera,
          // Igual tratamiento que FECHA_NACIMIENTO: string plano 'yyyy-mm-dd'.
          fechaBaja: row.payload.FECHA_BAJA ? row.payload.FECHA_BAJA.slice(0, 10) : null,
          causaBaja: row.payload.CAUSA_BAJA ?? null,
        }))

        if (filasCa.length > 0) {
          for (const lote of chunk(filasCa, FILAS_SQL_CA)) {
            operaciones.push(
              prisma.$executeRaw(Prisma.sql`
                UPDATE cARRERA_ADMINISTRATIVA
                SET
                  FECHA_BAJA = v.fechaBaja,
                  CAUSA_BAJA = v.causaBaja
                FROM (
                  VALUES ${Prisma.join(
                    lote.map(
                      (f) => Prisma.sql`(
                        CAST(${f.id} AS INT),
                        CAST(${f.fechaBaja} AS DATETIME),
                        CAST(${f.causaBaja} AS NVARCHAR(255))
                      )`,
                    ),
                    ',',
                  )}
                ) AS v(id, fechaBaja, causaBaja)
                WHERE cARRERA_ADMINISTRATIVA.ID_CARRERA = v.id
              `),
            )
          }
          caActualizadas = filasCa.length
        }
      await prisma.$transaction(operaciones)

    console.log(
      `[bulk-sync/commit] Transacción completada en ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
        `dp: ${dpInsertados} nuevas + ${dpActualizados} actualizadas | ca: ${caInsertadas} nuevas + ${caActualizadas} actualizadas`,
    )

    // ── Post-commit: recalcular y persistir derivados para TODOS ─────────────
    // Se ejecuta después de insertar las fases para que la antigüedad incluya
    // también las nuevas carreras de esta importación.
    faseActual = 'recalculo'
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
    const errMsg = err instanceof Error ? err.message : String(err)
    const codigo =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code ?? '')
        : ''
    const enTransaccion = faseActual === 'transaccion'
    // ¿Timeout de la transacción u otro error? Solo el timeout garantiza rollback real.
    const esTimeout = /P2028|P2020|timed?out|timeout|P2034/i.test(`${codigo} ${errMsg}`)
    console.error(
      `[bulk-sync/commit] Error en fase=${faseActual} tras ${((Date.now() - t0) / 1000).toFixed(1)}s — ` +
        `${codigo ? codigo + ' ' : ''}${errMsg}`,
    )

    const detalle = `${codigo ? codigo + ': ' : ''}${errMsg}`.slice(0, 300)
    const mensajeSegunFase = enTransaccion
      ? esTimeout
        ? 'La actualización tardó demasiado y se revirtieron todos los cambios. Por favor intentá nuevamente.'
        : 'Ocurrió un error durante la actualización y se revirtieron todos los cambios.'
      : 'Los cambios ya se guardaron en la base de datos, pero falló el recálculo de edades y antigüedades. No se revirtió nada; contactá al administrador con este detalle:'
    return NextResponse.json(
      {
        ok: false,
        error: `${mensajeSegunFase} [${detalle}]`,
        detalle,
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
  const t0 = Date.now()
  const agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
    include: {
      REGIMEN_JUBILATORIO: true,
      CARRERA_ADMINISTRATIVA: { orderBy: { FECHA_ALTA: 'asc' } },
    },
  })
  console.log(
    `[bulk-sync/commit] Recalculo: ${agentes.length} agentes cargados en ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  )

  // Consultas LAZY: solo se emiten contra la DB cuando el lote está por correrse.
  // (Antes se llamaba prisma.update() en el loop y TODAS las consultas salían de
  // golpe, saturando el pool de conexiones de SQL Server → timeouts P2024/P2028.)
  const queries: (() => PrismaClientNS.PrismaPromise<unknown>)[] = []

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

    queries.push(() =>
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

  // Ejecutar por lotes concurrentes ACOTADOS: cada wing espera a terminar antes
  // de lanzar el siguiente, manteniendo a lo sumo `CONCURRENCIA_RECALCULO`
  // consultas en vuelo (el pool de Prisma no se ve saturado).
  const wings = chunk(queries, CONCURRENCIA_RECALCULO)
  for (let i = 0; i < wings.length; i++) {
    await Promise.all(wings[i].map((q) => q()))
    if ((i + 1) % 20 === 0) {
      const hechas = Math.min((i + 1) * CONCURRENCIA_RECALCULO, queries.length)
      console.log(
        `[bulk-sync/commit] Recalculo: ${hechas}/${queries.length} agentes en ${((Date.now() - t0) / 1000).toFixed(1)}s`,
      )
    }
  }

  console.log(
    `[bulk-sync/commit] Recalculo finalizado: ${queries.length} agentes en ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  )
}
