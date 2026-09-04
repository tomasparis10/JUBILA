'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import type { JubilacionRecord, RenovProvisoria, TrazabilidadEntry } from '@/lib/jubilaciones-data'

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convierte un Date de DB a string 'dd/mm/aaaa' o '' si es null.
 *
 * IMPORTANTE: Se usan los métodos getUTC* en lugar de getDate/getMonth/getFullYear
 * para evitar el desplazamiento de zona horaria en servidores/clientes con UTC-3 (Argentina).
 * SQL Server guarda las fechas Date-only como UTC medianoche; si se usa getDate(),
 * en GMT-3 se restaría un día mostrando la fecha incorrecta.
 */
function dbDateToStr(date: Date | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = d.getUTCFullYear()
  return `${dd}/${mm}/${yyyy}`
}

/** Convierte string 'dd/mm/aaaa' a Date o null */
function strToDate(str: string): Date | null {
  if (!str || !str.trim()) return null
  const parts = str.trim().split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts
  const d = new Date(`${yyyy}-${mm}-${dd}`)
  return isNaN(d.getTime()) ? null : d
}

/** Calcula la antigüedad entre dos fechas como string "X años, Y meses" */
function calcAntiguedad(desde: Date | null | undefined, hasta: Date = new Date()): string {
  if (!desde) return ''
  const start = new Date(desde)
  let years = hasta.getFullYear() - start.getFullYear()
  let months = hasta.getMonth() - start.getMonth()
  if (months < 0) { years -= 1; months += 12 }
  return `${years} año${years !== 1 ? 's' : ''}, ${months} mes${months !== 1 ? 'es' : ''}`
}

// calcEdad eliminado: la edad se lee directamente del campo EDAD_ESTIMACION_JUBILACION de la DB.

/**
 * Mapea un registro JUBILA (con sus relaciones) al tipo JubilacionRecord
 * que consume el frontend.
 */
type JubilaWithRelations = Awaited<ReturnType<typeof fetchJubilaById>>

async function fetchJubilaById(id: number) {
  return prisma.jUBILA.findUnique({
    where: { ID_JUBILA: id },
    include: {
      DATOS_PERSONALES_AGENTE_JUBILA: {
        include: {
          REGIMEN_JUBILATORIO: true,
          CARRERA_ADMINISTRATIVA: {
            orderBy: { FECHA_ALTA: 'asc' },
          },
        },
      },
      HISTORIAL_BENEFICIO: {
        include: { BENEFICIO: true },
        orderBy: [{ FECHA_INICIO_BENEFICIO: 'asc' }, { ID_HISTORIAL_BENEFICIO: 'asc' }],
      },
      OTORGAMIENTO_RENOVACION_PROVISORIAS: {
        orderBy: { ID_OTORGAMIENTO_RENOVACION_PROVISORIAS: 'asc' },
      },
    },
  })
}

function mapJubilaToRecord(j: NonNullable<JubilaWithRelations>): JubilacionRecord {
  const agente = j.DATOS_PERSONALES_AGENTE_JUBILA
  const regimen = agente.REGIMEN_JUBILATORIO

  // ── Antigüedad, fecha estimada y edad: se leen directo de la DB ──────────
  // Los cálculos de antigüedad (recibo y licencias) y fecha estimada de
  // jubilación se realizan SOLO durante la actualización masiva (OPERACION)
  // y se persisten en estos campos. Aquí nunca se recalculan.
  const antiguedadRecibo = agente.ANTIGUEDAD_RECIBO_CALC ?? ''
  const antiguedadLicencias = agente.ANTIGUEDAD_LICENCIAS_CALC ?? ''
  const fechaEstimadaJubilacionOrdinaria = dbDateToStr(agente.FECHA_ESTIMADA_JUBILACI_N_ORDINARIA)

  // Trazabilidad: cada entrada del historial de beneficios
  const trazabilidad: TrazabilidadEntry[] = j.HISTORIAL_BENEFICIO.map((h) => ({
    fecha: dbDateToStr(h.FECHA_INICIO_BENEFICIO),
    beneficio: h.BENEFICIO.NOMBRE,
    observacion: '',
  }))

  // Beneficio actual: el último del historial sin fecha de fin
  const beneficioActual = [...j.HISTORIAL_BENEFICIO]
    .reverse()
    .find((h) => !h.FECHA_FIN_BENEFICIO)

  // Renovaciones: siempre 3 filas (rellenar con vacíos si hay menos)
  const rawRenovaciones = j.OTORGAMIENTO_RENOVACION_PROVISORIAS
  const renovaciones: RenovProvisoria[] = Array.from({ length: 3 }, (_, i) => {
    const rv = rawRenovaciones[i]
    if (!rv) return { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' }
    return {
      nroResRenov: rv.NUMERO_RESOLUCION_RENOVACION ?? '',
      nroExpMun: rv.NUMERO_EXPEDIENTE_MUNICIPAL ?? '',
      fechaDesdeExp: dbDateToStr(rv.FECHA_DESDE_PROVISORIA),
      fechaHastaExp: dbDateToStr(rv.FECHA_HASTA_PROVISORIA),
      jNroExpCaja: '',  // No existe columna directa en renovaciones
      nroDcto: rv.NUMERO_DECRETO_RESOLUCION_MUNICIPAL ?? '',
    }
  })

  return {
    id: String(j.ID_JUBILA),
    cuil: agente.CUIL ?? '',
    dni: agente.DNI_AGENTE ?? '',
    apellidoNombres: `${agente.APELLIDO_AGENTE} ${agente.NOMBRE_AGENTE}`.trim(),
    estadoActivo: agente.ESTADO_ACTIVO,
    trazabilidad,
    telefono: agente.NUMERO_TELEFONO ?? '',
    correo: agente.CORREO_ELECTRONICO ?? '',
    programa: agente.PROGRAMA ?? '',
    secretaria: agente.SECRETARIA ?? '',
    cargo: agente.CARGO ?? '',
    antiguedadRecibo,
    antiguedadLicencias,
    fechaNacimiento: dbDateToStr(agente.FECHA_NACIMIENTO),
    edadActual: agente.EDAD_ESTIMACION_JUBILACION != null ? String(agente.EDAD_ESTIMACION_JUBILACION) : '',
    fechaEstimadaJubilacionOrdinaria,
    beneficio: beneficioActual ? String(beneficioActual.ID_BENEFICIO) : '',
    nroTramite: j.INFORMACION_LABORAL_NUMERO_TRAMITE ?? '',
    fBaja: dbDateToStr(j.INFORMACION_LABORAL_FECHA_BAJA),
    nroExpMunRenuncia: j.INFORMACION_LABORAL_NUMERO_EXPEDIENTE_MUNICIPAL_RENUNCIA ?? '',
    jNroExpCaja: j.INFORMACION_LABORAL_JUBILACION_NUMERO_EXPEDIENTE_CAJA ?? '',
    nroResRenCaja: j.INFORMACION_LABORAL_NUMERO_RESOLUCION_CAJA ?? '',
    nroExpCajDeneg: j.INFORMACION_LABORAL_NUMERO_EXPEDIENTE_CAJA_DENEGADA ?? '',
    fInicExpMunPav: '',
    nroExpedienteMun: j.PASIVIDAD_NUMERO_EXPEDIENTE_PASIVIDAD ?? '',
    fInfPrevCaja: '',
    fecha: '',
    anios: regimen ? String(regimen.ANOS_APORTES_REQUERIDOS) : '',
    meses: '',
    dias: '',
    edadReq: regimen ? String(regimen.EDAD_REQUERIDA) : '',
    renovaciones,
    notificacionArt43: dbDateToStr(j.NOTIFICACION_ARTICULO_CUARENTAYTRES),
    nExpArt43SuspPago: j.NOTIFICACION_NUMERO_EXPEDIENTE_SUSPENCION_PAGO ?? '',
    fSolicitud: dbDateToStr(j.PASIVIDAD_FECHA_SOLICITUD),
    fEstimadaJOrd: dbDateToStr(j.PASIVIDAD_FECHA_ESTIMADA_JUBILACION_ORDINARIA),
    nroExpPasividad: j.PASIVIDAD_NUMERO_EXPEDIENTE_PASIVIDAD ?? '',
    fFirmaConvenio: dbDateToStr(j.PASIVIDAD_FECHA_FIRMA_CONVENIO),
    fInicioPasividad: dbDateToStr(j.PASIVIDAD_FECHA_INICIO_PASIVIDAD),
    observacionPasividad: j.PASIVIDAD_OBSERVACIONES_PASIVIDAD ?? '',
    observacion: j.OBSERVACIONES ?? '',
  }
}

/**
 * Mapea solo los datos personales del agente a JubilacionRecord,
 * dejando todos los campos de jubilación vacíos.
 * Se usa cuando el agente existe pero aún no tiene JUBILA registrada.
 */
type AgenteBase = NonNullable<Awaited<ReturnType<typeof prisma.dATOS_PERSONALES_AGENTE_JUBILA.findFirst>>>

function mapAgenteToRecord(agente: AgenteBase): JubilacionRecord {
  const renovacionVacia = { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' }

  // ── Antigüedad, fecha estimada y edad: se leen directo de la DB ──────────
  // Los cálculos de antigüedad (recibo y licencias) y fecha estimada de
  // jubilación se realizan SOLO durante la actualización masiva (OPERACION)
  // y se persisten en estos campos. Aquí nunca se recalculan.
  const antiguedadRecibo = agente.ANTIGUEDAD_RECIBO_CALC ?? ''
  const antiguedadLicencias = agente.ANTIGUEDAD_LICENCIAS_CALC ?? ''
  const fechaEstimadaJubilacionOrdinaria = dbDateToStr(agente.FECHA_ESTIMADA_JUBILACI_N_ORDINARIA)

  return {
    id: `agente-${agente.ID_DATOS_PERSONALES_AGENTE_JUBILA}`,
    cuil: agente.CUIL ?? '',
    dni: agente.DNI_AGENTE ?? '',
    apellidoNombres: `${agente.APELLIDO_AGENTE} ${agente.NOMBRE_AGENTE}`.trim(),
    estadoActivo: agente.ESTADO_ACTIVO,
    trazabilidad: [],
    telefono: agente.NUMERO_TELEFONO ?? '',
    correo: agente.CORREO_ELECTRONICO ?? '',
    programa: agente.PROGRAMA ?? '',
    secretaria: agente.SECRETARIA ?? '',
    cargo: agente.CARGO ?? '',
    antiguedadRecibo,
    antiguedadLicencias,
    fechaNacimiento: dbDateToStr(agente.FECHA_NACIMIENTO),
    edadActual: agente.EDAD_ESTIMACION_JUBILACION != null ? String(agente.EDAD_ESTIMACION_JUBILACION) : '',
    fechaEstimadaJubilacionOrdinaria,
    beneficio: '1',
    nroTramite: '', fBaja: '', nroExpMunRenuncia: '',
    jNroExpCaja: '', nroResRenCaja: '', nroExpCajDeneg: '',
    fInicExpMunPav: '', nroExpedienteMun: '', fInfPrevCaja: '',
    fecha: '', anios: '', meses: '', dias: '', edadReq: '',
    renovaciones: [renovacionVacia, renovacionVacia, renovacionVacia],
    notificacionArt43: '', nExpArt43SuspPago: '',
    fSolicitud: '', fEstimadaJOrd: '', nroExpPasividad: '',
    fFirmaConvenio: '', fInicioPasividad: '',
    observacionPasividad: '', observacion: '',
  }
}

// ── Server Actions ────────────────────────────────────────────────────────────

/**
 * Busca agentes por DNI o apellido con prioridad:
 * - Si el query es numérico (DNI):
 *     1ro busca coincidencia exacta de DNI
 *     2do busca DNIs que empiecen con el query
 * - Si el query es texto (apellido):
 *     1ro busca coincidencia exacta de APELLIDO_AGENTE
 *     2do busca apellidos que empiecen con el query
 * Los resultados exactos siempre aparecen primero.
 */
export async function searchAgentes(query: string): Promise<JubilacionRecord[]> {
  const q = query.trim()
  if (!q) return []

  // Helper para mapear un agente (con sus includes) a JubilacionRecord
  const includeClause = {
    JUBILA: {
      where: { BIT_BORRADO: false },
      orderBy: { FECHA_INICIO_CREACION_JUBILA: 'desc' as const },
      take: 1,
      include: {
        HISTORIAL_BENEFICIO: {
          include: { BENEFICIO: true },
          orderBy: { FECHA_INICIO_BENEFICIO: 'asc' as const },
        },
        OTORGAMIENTO_RENOVACION_PROVISORIAS: {
          orderBy: { ID_OTORGAMIENTO_RENOVACION_PROVISORIAS: 'asc' as const },
        },
      },
    },
    REGIMEN_JUBILATORIO: true as const,
    CARRERA_ADMINISTRATIVA: {
      orderBy: { FECHA_ALTA: 'asc' as const },
    },
  }

  function toRecords(agentes: Awaited<ReturnType<typeof prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany<{ include: typeof includeClause }>>>): JubilacionRecord[] {
    const records: JubilacionRecord[] = []
    for (const agente of agentes) {
      const { JUBILA: jubilaList, ...agenteRest } = agente
      const jubila = jubilaList[0]
      if (jubila) {
        records.push(mapJubilaToRecord({ ...jubila, DATOS_PERSONALES_AGENTE_JUBILA: agenteRest }))
      } else {
        records.push(mapAgenteToRecord(agenteRest))
      }
    }
    return records
  }

  try {
    const isNumeric = /^\d+$/.test(q)

    if (isNumeric) {
      // ── Búsqueda por DNI ──────────────────────────────────────────────────
      // 1º Coincidencia exacta
      const exactos = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
        where: { DNI_AGENTE: q },
        include: includeClause,
        take: 50,
      })
      if (exactos.length > 0) return toRecords(exactos)

      // 2º DNIs que empiecen con el número ingresado
      const parciales = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
        where: { DNI_AGENTE: { startsWith: q } },
        include: includeClause,
        orderBy: { DNI_AGENTE: 'asc' },
        take: 50,
      })
      return toRecords(parciales)
    } else {
      // ── Búsqueda por Apellido ─────────────────────────────────────────────
      // 1º Coincidencia exacta de apellido (case-insensitive via contains con q exacto)
      const exactos = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
        where: { APELLIDO_AGENTE: q },
        include: includeClause,
        take: 50,
      })
      if (exactos.length > 0) return toRecords(exactos)

      // 2º Apellidos que empiecen con el texto ingresado
      const parciales = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
        where: { APELLIDO_AGENTE: { startsWith: q } },
        include: includeClause,
        orderBy: { APELLIDO_AGENTE: 'asc' },
        take: 50,
      })
      return toRecords(parciales)
    }
  } catch (error) {
    console.error('[searchAgentes] Error:', error)
    throw new Error('Error al buscar agentes en la base de datos.')
  }
}

/**
 * Devuelve el último agente cargado:
 * - Si hay registros JUBILA, devuelve el más reciente.
 * - Si la tabla JUBILA está vacía, devuelve el último agente de datos personales.
 */
export async function getLastRecord(): Promise<JubilacionRecord | null> {
  try {
    // Intentar obtener el último JUBILA activo
    const lastJubila = await prisma.jUBILA.findFirst({
      where: { BIT_BORRADO: false },
      orderBy: { FECHA_INICIO_CREACION_JUBILA: 'desc' },
      include: {
        DATOS_PERSONALES_AGENTE_JUBILA: {
          include: {
            REGIMEN_JUBILATORIO: true,
            CARRERA_ADMINISTRATIVA: {
              orderBy: { FECHA_ALTA: 'asc' },
            },
          },
        },
        HISTORIAL_BENEFICIO: {
          include: { BENEFICIO: true },
          orderBy: { FECHA_INICIO_BENEFICIO: 'asc' },
        },
        OTORGAMIENTO_RENOVACION_PROVISORIAS: {
          orderBy: { ID_OTORGAMIENTO_RENOVACION_PROVISORIAS: 'asc' },
        },
      },
    })

    if (lastJubila) {
      return mapJubilaToRecord(lastJubila)
    }

    // Si no hay JUBILA, devolver el último agente de datos personales
    const lastAgente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findFirst({
      orderBy: { ID_DATOS_PERSONALES_AGENTE_JUBILA: 'desc' },
    })
    if (lastAgente) {
      return mapAgenteToRecord(lastAgente)
    }

    return null
  } catch (error) {
    console.error('[getLastRecord] Error:', error)
    return null
  }
}

export async function getJubilaById(id: string): Promise<JubilacionRecord | null> {
  try {
    const jubila = await fetchJubilaById(Number(id))
    if (!jubila || jubila.BIT_BORRADO) return null
    return mapJubilaToRecord(jubila)
  } catch (error) {
    console.error('[getJubilaById] Error:', error)
    throw new Error('Error al obtener el registro de jubilación.')
  }
}

/**
 * Obtiene los primeros N registros JUBILA activos (para la lista inicial).
 */
export async function getJubilaList(take = 50): Promise<JubilacionRecord[]> {
  try {
    const jubilas = await prisma.jUBILA.findMany({
      where: { BIT_BORRADO: false },
      orderBy: { FECHA_ULTIMA_MODIFICACION: 'desc' },
      take,
      include: {
        DATOS_PERSONALES_AGENTE_JUBILA: {
          include: {
            REGIMEN_JUBILATORIO: true,
            CARRERA_ADMINISTRATIVA: {
              orderBy: { FECHA_ALTA: 'asc' },
            },
          },
        },
        HISTORIAL_BENEFICIO: {
          include: { BENEFICIO: true },
          orderBy: { FECHA_INICIO_BENEFICIO: 'asc' },
        },
        OTORGAMIENTO_RENOVACION_PROVISORIAS: {
          orderBy: { ID_OTORGAMIENTO_RENOVACION_PROVISORIAS: 'asc' },
        },
      },
    })
    return jubilas.map(mapJubilaToRecord)
  } catch (error) {
    console.error('[getJubilaList] Error:', error)
    return []
  }
}

/**
 * Actualiza los campos editables de un registro JUBILA existente.
 */
export async function updateJubila(
  id: string,
  data: Partial<JubilacionRecord>,
  usuarioId: number = 1,
): Promise<{ ok: boolean; error?: string; record?: JubilacionRecord }> {
  try {
    const jubilaId = Number(id)
    await prisma.jUBILA.update({
      where: { ID_JUBILA: jubilaId },
      data: {
        INFORMACION_LABORAL_NUMERO_TRAMITE: data.nroTramite ?? undefined,
        INFORMACION_LABORAL_FECHA_BAJA: data.fBaja ? strToDate(data.fBaja) : undefined,
        INFORMACION_LABORAL_NUMERO_EXPEDIENTE_MUNICIPAL_RENUNCIA: data.nroExpMunRenuncia ?? undefined,
        INFORMACION_LABORAL_JUBILACION_NUMERO_EXPEDIENTE_CAJA: data.jNroExpCaja ?? undefined,
        INFORMACION_LABORAL_NUMERO_RESOLUCION_CAJA: data.nroResRenCaja ?? undefined,
        INFORMACION_LABORAL_NUMERO_EXPEDIENTE_CAJA_DENEGADA: data.nroExpCajDeneg ?? undefined,
        PASIVIDAD_FECHA_SOLICITUD: data.fSolicitud ? strToDate(data.fSolicitud) : undefined,
        PASIVIDAD_FECHA_ESTIMADA_JUBILACION_ORDINARIA: data.fEstimadaJOrd ? strToDate(data.fEstimadaJOrd) : undefined,
        PASIVIDAD_NUMERO_EXPEDIENTE_PASIVIDAD: data.nroExpPasividad ?? undefined,
        PASIVIDAD_FECHA_FIRMA_CONVENIO: data.fFirmaConvenio ? strToDate(data.fFirmaConvenio) : undefined,
        PASIVIDAD_FECHA_INICIO_PASIVIDAD: data.fInicioPasividad ? strToDate(data.fInicioPasividad) : undefined,
        PASIVIDAD_OBSERVACIONES_PASIVIDAD: data.observacionPasividad ?? undefined,
        NOTIFICACION_ARTICULO_CUARENTAYTRES: data.notificacionArt43 ? strToDate(data.notificacionArt43) : undefined,
        NOTIFICACION_NUMERO_EXPEDIENTE_SUSPENCION_PAGO: data.nExpArt43SuspPago ?? undefined,
        OBSERVACIONES: data.observacion ?? undefined,
        FECHA_ULTIMA_MODIFICACION: new Date(),
        USUARIO_MODIFICACION: usuarioId,
      },
    })

    // Actualizar renovaciones si fueron modificadas
    if (data.renovaciones) {
      // Eliminar las existentes y recrear
      await prisma.oTORGAMIENTO_RENOVACION_PROVISORIAS.deleteMany({
        where: { ID_JUBILA: jubilaId },
      })
      const renovsConDatos = data.renovaciones.filter(
        (rv) => rv.nroResRenov || rv.nroExpMun || rv.fechaDesdeExp || rv.fechaHastaExp || rv.nroDcto
      )
      if (renovsConDatos.length > 0) {
        await prisma.oTORGAMIENTO_RENOVACION_PROVISORIAS.createMany({
          data: renovsConDatos.map((rv) => ({
            ID_JUBILA: jubilaId,
            NUMERO_RESOLUCION_RENOVACION: rv.nroResRenov || null,
            NUMERO_EXPEDIENTE_MUNICIPAL: rv.nroExpMun || null,
            FECHA_DESDE_PROVISORIA: rv.fechaDesdeExp ? strToDate(rv.fechaDesdeExp) : null,
            FECHA_HASTA_PROVISORIA: rv.fechaHastaExp ? strToDate(rv.fechaHastaExp) : null,
            NUMERO_DECRETO_RESOLUCION_MUNICIPAL: rv.nroDcto || null,
          })),
        })
      }
    }

    // Actualizar beneficio en historial si cambió o si no existía
    if (data.beneficio) {
      const beneficioId = Number(data.beneficio)
      const ultimoHistorial = await prisma.hISTORIAL_BENEFICIO.findFirst({
        where: { ID_JUBILA: jubilaId, FECHA_FIN_BENEFICIO: null },
        orderBy: [{ FECHA_INICIO_BENEFICIO: 'desc' }, { ID_HISTORIAL_BENEFICIO: 'desc' }],
      })
      if (!ultimoHistorial) {
        await prisma.hISTORIAL_BENEFICIO.create({
          data: {
            ID_JUBILA: jubilaId,
            ID_BENEFICIO: beneficioId,
            FECHA_INICIO_BENEFICIO: new Date(),
            USUARIO_ULTIMA_MODIFICACION: usuarioId,
          },
        })
      } else if (ultimoHistorial.ID_BENEFICIO !== beneficioId) {
        // Cierra el beneficio anterior
        await prisma.hISTORIAL_BENEFICIO.update({
          where: { ID_HISTORIAL_BENEFICIO: ultimoHistorial.ID_HISTORIAL_BENEFICIO },
          data: { FECHA_FIN_BENEFICIO: new Date() },
        })
        // Crea el nuevo beneficio
        await prisma.hISTORIAL_BENEFICIO.create({
          data: {
            ID_JUBILA: jubilaId,
            ID_BENEFICIO: beneficioId,
            FECHA_INICIO_BENEFICIO: new Date(),
            USUARIO_ULTIMA_MODIFICACION: usuarioId,
          },
        })
      }
    }

    revalidatePath('/')
    const fresh = await fetchJubilaById(jubilaId)
    const record = fresh ? mapJubilaToRecord(fresh) : undefined
    return { ok: true, record }
  } catch (error) {
    console.error('[updateJubila] Error:', error)
    return { ok: false, error: 'Error al guardar los cambios en la base de datos.' }
  }
}

/**
 * Crea un nuevo registro de AGENTE en DATOS_PERSONALES_AGENTE_JUBILA
 * (solo datos personales, sin datos de jubilación).
 * Estado activo queda predeterminado en true (1).
 */
export async function createAgente(
  data: Partial<JubilacionRecord>,
): Promise<{ ok: boolean; id?: string; error?: string; record?: JubilacionRecord }> {
  try {
    const dni = (data.dni ?? '').trim()
    const apellidoNombres = (data.apellidoNombres ?? '').trim()

    if (!dni) {
      return { ok: false, error: 'El DNI es obligatorio.' }
    }
    if (!apellidoNombres) {
      return { ok: false, error: 'El Apellido y Nombres son obligatorios.' }
    }

    // Verificar si ya existe un agente con ese DNI
    const existente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({
      where: { DNI_AGENTE: dni },
    })
    if (existente) {
      return { ok: false, error: `Ya existe un agente registrado con el DNI ${dni}.` }
    }

    const partes = apellidoNombres.split(' ')
    const apellido = partes[0] ?? ''
    const nombre = partes.slice(1).join(' ') || apellido

    const nuevoAgente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.create({
      data: {
        DNI_AGENTE: dni,
        NOMBRE_AGENTE: nombre,
        APELLIDO_AGENTE: apellido,
        FECHA_NACIMIENTO: strToDate(data.fechaNacimiento ?? '') ?? new Date(1970, 0, 1),
        SECRETARIA: data.secretaria?.trim() || null,
        PROGRAMA: data.programa?.trim() || null,
        CARGO: data.cargo?.trim() || null,
        CUIL: data.cuil?.trim() || null,
        NUMERO_TELEFONO: data.telefono?.trim() || null,
        CORREO_ELECTRONICO: data.correo?.trim() || null,
        ANTIGUEDAD_RECIBO: strToDate(data.antiguedadRecibo ?? ''),
        ANTIGUEDAD_LICENCIAS: strToDate(data.antiguedadLicencias ?? ''),
        FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: strToDate(data.fechaEstimadaJubilacionOrdinaria ?? ''),
        EDAD_ESTIMACION_JUBILACION: data.edadActual ? parseInt(data.edadActual) : null,
        ESTADO_ACTIVO: true, // Predeterminado activo
        ID_REGIMEN_JUBILATORIO: 1, // Régimen default
      },
    })

    const record = mapAgenteToRecord(nuevoAgente)
    revalidatePath('/')
    return { ok: true, id: `agente-${nuevoAgente.ID_DATOS_PERSONALES_AGENTE_JUBILA}`, record }
  } catch (error) {
    console.error('[createAgente] Error:', error)
    return { ok: false, error: 'Error al registrar el nuevo agente en la base de datos.' }
  }
}

/**
 * Crea un nuevo registro JUBILA para un agente existente (buscado por DNI).
 * Si el agente no existe en DATOS_PERSONALES_AGENTE_JUBILA, lo crea también.
 */
export async function createJubila(
  data: Partial<JubilacionRecord>,
  usuarioId: number = 1,
): Promise<{ ok: boolean; id?: string; error?: string; record?: JubilacionRecord }> {
  try {
    if (!data.dni || !data.apellidoNombres) {
      return { ok: false, error: 'DNI y apellido/nombre son obligatorios.' }
    }

    // Buscar agente por DNI
    let agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({
      where: { DNI_AGENTE: data.dni },
    })

    // Si no existe, crearlo
    if (!agente) {
      const partes = (data.apellidoNombres ?? '').trim().split(' ')
      const apellido = partes[0] ?? ''
      const nombre = partes.slice(1).join(' ') || apellido

      agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.create({
        data: {
          DNI_AGENTE: data.dni,
          NOMBRE_AGENTE: nombre,
          APELLIDO_AGENTE: apellido,
          FECHA_NACIMIENTO: strToDate(data.fechaNacimiento ?? '') ?? new Date(),
          SECRETARIA: data.secretaria || null,
          PROGRAMA: data.programa || null,
          CARGO: data.cargo || null,
          CUIL: data.cuil || null,
          NUMERO_TELEFONO: data.telefono?.trim() || null,
          CORREO_ELECTRONICO: data.correo?.trim() || null,
          ANTIGUEDAD_RECIBO: null,
          ANTIGUEDAD_LICENCIAS: null,
          ESTADO_ACTIVO: true,
          ID_REGIMEN_JUBILATORIO: 1, // Régimen default; ajustar según tabla
        },
      })
    }

    // Crear el registro JUBILA
    const jubila = await prisma.jUBILA.create({
      data: {
        ID_AGENTE: agente.ID_DATOS_PERSONALES_AGENTE_JUBILA,
        INFORMACION_LABORAL_NUMERO_TRAMITE: data.nroTramite || null,
        INFORMACION_LABORAL_FECHA_BAJA: data.fBaja ? strToDate(data.fBaja) : null,
        INFORMACION_LABORAL_NUMERO_EXPEDIENTE_MUNICIPAL_RENUNCIA: data.nroExpMunRenuncia || null,
        INFORMACION_LABORAL_JUBILACION_NUMERO_EXPEDIENTE_CAJA: data.jNroExpCaja || null,
        INFORMACION_LABORAL_NUMERO_RESOLUCION_CAJA: data.nroResRenCaja || null,
        INFORMACION_LABORAL_NUMERO_EXPEDIENTE_CAJA_DENEGADA: data.nroExpCajDeneg || null,
        PASIVIDAD_FECHA_SOLICITUD: data.fSolicitud ? strToDate(data.fSolicitud) : null,
        PASIVIDAD_FECHA_ESTIMADA_JUBILACION_ORDINARIA: data.fEstimadaJOrd ? strToDate(data.fEstimadaJOrd) : null,
        PASIVIDAD_NUMERO_EXPEDIENTE_PASIVIDAD: data.nroExpPasividad || null,
        PASIVIDAD_FECHA_FIRMA_CONVENIO: data.fFirmaConvenio ? strToDate(data.fFirmaConvenio) : null,
        PASIVIDAD_FECHA_INICIO_PASIVIDAD: data.fInicioPasividad ? strToDate(data.fInicioPasividad) : null,
        PASIVIDAD_OBSERVACIONES_PASIVIDAD: data.observacionPasividad || null,
        NOTIFICACION_ARTICULO_CUARENTAYTRES: data.notificacionArt43 ? strToDate(data.notificacionArt43) : null,
        NOTIFICACION_NUMERO_EXPEDIENTE_SUSPENCION_PAGO: data.nExpArt43SuspPago || null,
        OBSERVACIONES: data.observacion || null,
        FECHA_INICIO_CREACION_JUBILA: new Date(),
        USUARIO_CREACION: usuarioId,
        BIT_BORRADO: false,
      },
    })

    // Agregar beneficio inicial si fue especificado
    if (data.beneficio) {
      await prisma.hISTORIAL_BENEFICIO.create({
        data: {
          ID_JUBILA: jubila.ID_JUBILA,
          ID_BENEFICIO: Number(data.beneficio),
          FECHA_INICIO_BENEFICIO: new Date(),
          USUARIO_ULTIMA_MODIFICACION: usuarioId,
        },
      })
    }

    // Agregar renovaciones si tienen datos
    const renovsConDatos = (data.renovaciones ?? []).filter(
      (rv) => rv.nroResRenov || rv.nroExpMun || rv.fechaDesdeExp || rv.fechaHastaExp || rv.nroDcto
    )
    if (renovsConDatos.length > 0) {
      await prisma.oTORGAMIENTO_RENOVACION_PROVISORIAS.createMany({
        data: renovsConDatos.map((rv) => ({
          ID_JUBILA: jubila.ID_JUBILA,
          NUMERO_RESOLUCION_RENOVACION: rv.nroResRenov || null,
          NUMERO_EXPEDIENTE_MUNICIPAL: rv.nroExpMun || null,
          FECHA_DESDE_PROVISORIA: rv.fechaDesdeExp ? strToDate(rv.fechaDesdeExp) : null,
          FECHA_HASTA_PROVISORIA: rv.fechaHastaExp ? strToDate(rv.fechaHastaExp) : null,
          NUMERO_DECRETO_RESOLUCION_MUNICIPAL: rv.nroDcto || null,
        })),
      })
    }

    revalidatePath('/')
    const fresh = await fetchJubilaById(jubila.ID_JUBILA)
    const record = fresh ? mapJubilaToRecord(fresh) : undefined
    return { ok: true, id: String(jubila.ID_JUBILA), record }
  } catch (error) {
    console.error('[createJubila] Error:', error)
    return { ok: false, error: 'Error al crear el registro en la base de datos.' }
  }
}

/**
 * Elimina lógicamente un registro JUBILA (BIT_BORRADO = true).
 */
export async function deleteJubila(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.jUBILA.update({
      where: { ID_JUBILA: Number(id) },
      data: { BIT_BORRADO: true },
    })
    revalidatePath('/')
    return { ok: true }
  } catch (error) {
    console.error('[deleteJubila] Error:', error)
    return { ok: false, error: 'Error al eliminar el registro.' }
  }
}

/**
 * Tipo simplificado para el widget de próximas jubilaciones.
 */
export interface AgenteProxJubilacion {
  dni: string
  apellidoNombres: string
  fechaEstimada: string // 'dd/mm/aaaa'
  cuil: string
  fechaNacimiento: string
  secretaria: string
  programa: string
  cargo: string
  antiguedadRecibo: string
  antiguedadLicencias: string
}

/**
 * Devuelve los agentes activos cuya fecha estimada de jubilación ordinaria
 * (almacenada en la DB, calculada en la actualización masiva) cae dentro
 * del mes en curso (±30 días respecto a hoy).
 * No recalcula ninguna fecha: usa FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA de la DB.
 */
export async function getAgentesProxJubilacion(): Promise<AgenteProxJubilacion[]> {
  try {
    const hoy = new Date()
    const hace30Dias = new Date(hoy)
    hace30Dias.setDate(hoy.getDate() - 30)
    const en30Dias = new Date(hoy)
    en30Dias.setDate(hoy.getDate() + 30)
    hace30Dias.setUTCHours(0, 0, 0, 0)
    en30Dias.setUTCHours(23, 59, 59, 999)

    const agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
      where: {
        ESTADO_ACTIVO: true,
        FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: {
          gte: hace30Dias,
          lte: en30Dias,
        },
      },
      select: {
        DNI_AGENTE: true,
        NOMBRE_AGENTE: true,
        APELLIDO_AGENTE: true,
        FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: true,
        CUIL: true,
        FECHA_NACIMIENTO: true,
        SECRETARIA: true,
        PROGRAMA: true,
        CARGO: true,
        ANTIGUEDAD_RECIBO_CALC: true,
        ANTIGUEDAD_LICENCIAS_CALC: true,
      },
      orderBy: {
        FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: 'asc',
      },
      take: 100,
    })

    return agentes.map((agente) => ({
      dni: agente.DNI_AGENTE ?? '',
      apellidoNombres: `${agente.APELLIDO_AGENTE} ${agente.NOMBRE_AGENTE}`.trim(),
      fechaEstimada: dbDateToStr(agente.FECHA_ESTIMADA_JUBILACI_N_ORDINARIA),
      cuil: agente.CUIL ?? '',
      fechaNacimiento: dbDateToStr(agente.FECHA_NACIMIENTO),
      secretaria: agente.SECRETARIA ?? '',
      programa: agente.PROGRAMA ?? '',
      cargo: agente.CARGO ?? '',
      antiguedadRecibo: agente.ANTIGUEDAD_RECIBO_CALC ?? '',
      antiguedadLicencias: agente.ANTIGUEDAD_LICENCIAS_CALC ?? '',
    }))
  } catch (error) {
    console.error('[getAgentesProxJubilacion] Error:', error)
    return []
  }
}

/**
 * Devuelve los datos completos de agentes por lista de DNIs.
 * Usado para generar el informe Excel desde el widget de próximas jubilaciones.
 * No recalcula ninguna fecha: usa los campos persistidos de la DB.
 */
export async function getAgentesData(dnis: string[]): Promise<AgenteProxJubilacion[]> {
  if (!dnis || dnis.length === 0) return []
  try {
    const agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
      where: {
        DNI_AGENTE: { in: dnis },
      },
      select: {
        DNI_AGENTE: true,
        NOMBRE_AGENTE: true,
        APELLIDO_AGENTE: true,
        FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: true,
        CUIL: true,
        FECHA_NACIMIENTO: true,
        SECRETARIA: true,
        PROGRAMA: true,
        CARGO: true,
        ANTIGUEDAD_RECIBO_CALC: true,
        ANTIGUEDAD_LICENCIAS_CALC: true,
      },
    })

    return agentes.map((agente) => ({
      dni: agente.DNI_AGENTE ?? '',
      apellidoNombres: `${agente.APELLIDO_AGENTE} ${agente.NOMBRE_AGENTE}`.trim(),
      fechaEstimada: dbDateToStr(agente.FECHA_ESTIMADA_JUBILACI_N_ORDINARIA),
      cuil: agente.CUIL ?? '',
      fechaNacimiento: dbDateToStr(agente.FECHA_NACIMIENTO),
      secretaria: agente.SECRETARIA ?? '',
      programa: agente.PROGRAMA ?? '',
      cargo: agente.CARGO ?? '',
      antiguedadRecibo: agente.ANTIGUEDAD_RECIBO_CALC ?? '',
      antiguedadLicencias: agente.ANTIGUEDAD_LICENCIAS_CALC ?? '',
    }))
  } catch (error) {
    console.error('[getAgentesData] Error:', error)
    return []
  }
}
