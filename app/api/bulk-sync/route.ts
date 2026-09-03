import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'
import {
  calcAntiguedadRecibo,
  calcAntiguedadLicencias,
  type FaseCarrera,
} from '@/utils/calculosPrevisionales'

interface DiffField { campo: string; anterior: string; nuevo: string }

interface AgenteNuevo {
  dni: string; nombre: string; apellido: string; secretaria: string
  programa: string; cargo: string; sexo: string; estadoActivo: boolean
  cuil: string; telefono: string; correo: string; fechaNacimiento: string
}

interface AgenteActualizado { dni: string; nombre: string; diffs: DiffField[] }
interface CarreraNueva { dni: string; fechaAlta: string; fechaBaja: string; causaBaja: string }
interface CarreraActualizada { dni: string; fechaAlta: string; diffs: DiffField[] }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de fecha — 100% UTC-safe
//
// PROBLEMA RAÍZ: XLSX serializa fechas como número de días desde 1900-01-01.
// Si construimos `new Date()` con hora local, en GMT-3 la medianoche UTC
// se convierte en 21:00 del día anterior, provocando el "día -1".
//
// SOLUCIÓN: construir siempre con Date.UTC() y usar getUTC* para formatear.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte un número serial de Excel (días desde 30/12/1899) a Date UTC.
 * Devuelve una fecha cuya parte UTC corresponde exactamente a la fecha del Excel.
 */
function excelSerialToDateUTC(serial: number): Date {
  // Día 1 = 01/01/1900; usamos 25569 = días entre 30/12/1899 y 01/01/1970 (epoch Unix)
  const MS_POR_DIA = 86400000
  // Corrección del bug de Lotus 1-2-3: Excel cuenta el 29/02/1900 como válido (no lo era)
  const corregido = serial > 59 ? serial - 1 : serial
  return new Date(Math.round((corregido - 25569) * MS_POR_DIA))
}

/**
 * Parsea cualquier valor de celda Excel a Date UTC o null.
 * Soporta: número serial, string 'dd/mm/aaaa', string 'aaaa-mm-dd', objeto Date.
 */
function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null

  // Número serial de Excel (lo más común cuando cellDates: false)
  if (typeof value === 'number') {
    if (value <= 0) return null
    return excelSerialToDateUTC(value)
  }

  // Objeto Date nativo (cuando cellDates: true, no usamos esto pero por si acaso)
  if (value instanceof Date) {
    // Reconstruir en UTC usando las partes locales del Date que devolvió XLSX
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()))
  }

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null

    // Formato dd/mm/aaaa
    const matchDMY = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (matchDMY) {
      const [, dd, mm, yyyy] = matchDMY
      const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
      return isNaN(d.getTime()) ? null : d
    }

    // Formato aaaa-mm-dd
    const matchYMD = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (matchYMD) {
      const [, yyyy, mm, dd] = matchYMD
      const d = new Date(Date.UTC(Number(yyyy), Number(mm) - 1, Number(dd)))
      return isNaN(d.getTime()) ? null : d
    }
  }

  return null
}

/**
 * Formatea un Date a string 'dd/mm/aaaa' usando componentes UTC.
 * Evita el desplazamiento de zona horaria.
 */
function dateToStr(d: Date | null | undefined): string {
  if (!d) return ''
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

/**
 * Suma `años` años a una fecha UTC, manejando el borde del 29/02.
 */
function addYearsUTC(date: Date, years: number): Date {
  const d = new Date(date)
  const newYear = d.getUTCFullYear() + years
  const month = d.getUTCMonth()
  const day = d.getUTCDate()
  // Caso borde: 29/02 en año no bisiesto → 28/02
  const maxDay = new Date(Date.UTC(newYear, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(newYear, month, Math.min(day, maxDay)))
}

/**
 * Calcula la edad en años enteros a partir de una fecha UTC de nacimiento.
 */
function calcEdadUTC(fechaNac: Date): number {
  const hoy = new Date()
  const hoyY = hoy.getUTCFullYear(), hoyM = hoy.getUTCMonth(), hoyD = hoy.getUTCDate()
  const nacY = fechaNac.getUTCFullYear(), nacM = fechaNac.getUTCMonth(), nacD = fechaNac.getUTCDate()
  let edad = hoyY - nacY
  if (hoyM < nacM || (hoyM === nacM && hoyD < nacD)) edad--
  return edad
}

function norm(v: unknown): string { return String(v ?? '').trim() }

function nowStr(): string {
  const now = new Date()
  return `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
}

function readExcel(filename: string): Record<string, unknown>[] {
  const filePath = path.join(process.cwd(), 'data', filename)
  if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: data/${filename}`)
  const buffer = fs.readFileSync(filePath)
  // cellDates: false → recibimos números seriales, los parseamos nosotros con UTC
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1 }) as unknown[][]
  if (raw.length < 2) return []
  const headers = (raw[1] as unknown[]).map((h) => String(h ?? '').trim())
  const rows: Record<string, unknown>[] = []
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i] as unknown[]
    const obj: Record<string, unknown> = {}
    headers.forEach((h, idx) => { obj[h] = row[idx] ?? '' })
    rows.push(obj)
  }
  return rows
}

/**
 * Replica la lógica de normalización de regímenes del script Python.
 * Soporta: PASIVISADOS prefix, SALUD con texto extra de ley, etc.
 */
function obtenerIdRegimen(
  nombreRegimen: string,
  sexo: string,
  regimenes: { ID_REGIMEN_JUBILATORIO: number; NOMBRE_REGIMEN: string; SEXO: string | null }[]
): number | null {
  const reg = nombreRegimen.toUpperCase().replace('PASIVISADOS - ', '').trim()
  const sx = sexo.toUpperCase().trim()

  // Búsqueda exacta primero (normalizada)
  for (const r of regimenes) {
    const rNombre = r.NOMBRE_REGIMEN.toUpperCase().replace('PASIVISADOS - ', '').trim()
    const rSexo = (r.SEXO ?? '').toUpperCase().trim()
    if (rNombre === reg && rSexo === sx) return r.ID_REGIMEN_JUBILATORIO
  }

  // Búsqueda parcial para SALUD (que tiene texto extra de ley)
  for (const r of regimenes) {
    const rNombre = r.NOMBRE_REGIMEN.toUpperCase()
    const rSexo = (r.SEXO ?? '').toUpperCase().trim()
    if (reg.includes('SALUD') && rNombre.includes('SALUD') && rSexo === sx) {
      return r.ID_REGIMEN_JUBILATORIO
    }
  }

  return null
}

/**
 * Recalcula y persiste FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA y EDAD_ESTIMACION_JUBILACION
 * para un agente dado su DNI. Busca REGIMEN_JUBILATORIO y FECHA_NACIMIENTO de la DB.
 */
async function recalcularCamposDerivados(dni: string): Promise<void> {
  const agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({
    where: { DNI_AGENTE: dni },
    include: { REGIMEN_JUBILATORIO: true },
  })
  if (!agente || !agente.FECHA_NACIMIENTO) return

  const edadReq = agente.REGIMEN_JUBILATORIO?.EDAD_REQUERIDA ?? null
  if (edadReq == null) return

  const fechaEstimada = addYearsUTC(agente.FECHA_NACIMIENTO, edadReq)
  const edadActual = calcEdadUTC(agente.FECHA_NACIMIENTO)

  await prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({
    where: { DNI_AGENTE: dni },
    data: {
      FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: fechaEstimada,
      EDAD_ESTIMACION_JUBILACION: edadActual,
    },
  })
}

/**
 * Recalcula y persiste ANTIGUEDAD_RECIBO_CALC y ANTIGUEDAD_LICENCIAS_CALC
 * para un agente dado su DNI. Lee las fases de CARRERA_ADMINISTRATIVA y
 * los campos derivados de la DB.
 */
async function recalcularAntiguedades(dni: string): Promise<void> {
  const agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({
    where: { DNI_AGENTE: dni },
    include: {
      CARRERA_ADMINISTRATIVA: { orderBy: { FECHA_ALTA: 'asc' } },
    },
  })
  if (!agente) return

  const fases: FaseCarrera[] = (agente.CARRERA_ADMINISTRATIVA ?? []).map((f) => ({
    FECHA_ALTA: f.FECHA_ALTA,
    FECHA_BAJA: f.FECHA_BAJA,
  }))
  const fechaJubRaw = agente.FECHA_ESTIMADA_JUBILACI_N_ORDINARIA
  const fechaJubilacion = fechaJubRaw ? new Date(fechaJubRaw) : null

  const antiguedadRecibo = calcAntiguedadRecibo(fases, fechaJubilacion)
  const antiguedadLicencias = calcAntiguedadLicencias(fases, fechaJubilacion)

  await prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({
    where: { DNI_AGENTE: dni },
    data: {
      ANTIGUEDAD_RECIBO_CALC: antiguedadRecibo,
      ANTIGUEDAD_LICENCIAS_CALC: antiguedadLicencias,
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Procesamiento Datos Personales
// ─────────────────────────────────────────────────────────────────────────────
async function processDatosPersonales() {
  const rows = readExcel('DatosPersonales.xlsx')

  // Cargar todos los regímenes (con SEXO) para la normalización
  const regimenes = await prisma.rEGIMEN_JUBILATORIO.findMany({
    select: { ID_REGIMEN_JUBILATORIO: true, NOMBRE_REGIMEN: true, SEXO: true, EDAD_REQUERIDA: true },
  })

  const nuevos: AgenteNuevo[] = []
  const actualizados: AgenteActualizado[] = []
  let sinCambios = 0; let errores = 0; const errorDetails: string[] = []
  const dnisAfectados: string[] = []

  for (const row of rows) {
    const dni = norm(row['DNI_AGENTE'])
    if (!dni) continue
    try {
      const nombreRegimen = norm(row['NOMBRE_REGIMEN'])
      const sexo = norm(row['SEXO'])
      const idRegimen = obtenerIdRegimen(nombreRegimen, sexo, regimenes)

      const estadoActivo = norm(row['ESTADO_ACTIVO']).toUpperCase() === 'ACTIVO'
      const fechaNac = parseExcelDate(row['FECHA_NACIMIENTO'])
      const nombre = norm(row['NOMBRE_AGENTE'])
      const apellido = norm(row['APELLIDO_AGENTE'])
      const secretaria = norm(row['SECRETARIA']) || null
      const programa = norm(row['PROGRAMA']) || null
      const cargo = norm(row['CARGO']) || null
      const cuil = norm(row['CUIL']) || null
      const telefono = norm(row['NUMERO_TELEFONO']) || null
      const correo = norm(row['CORREO_ELECTRONICO']) || null

      // Calcular campos derivados si tenemos los datos necesarios
      const edadReq = idRegimen != null
        ? (regimenes.find((r) => r.ID_REGIMEN_JUBILATORIO === idRegimen)?.EDAD_REQUERIDA ?? null)
        : null
      const fechaEstimada = (fechaNac && edadReq != null) ? addYearsUTC(fechaNac, edadReq) : null
      const edadActual = fechaNac ? calcEdadUTC(fechaNac) : null

      const existente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({
        where: { DNI_AGENTE: dni },
      })

      if (!existente) {
        if (!fechaNac) {
          errores++
          errorDetails.push(`DNI ${dni}: fecha de nacimiento inválida`)
          continue
        }
        await prisma.dATOS_PERSONALES_AGENTE_JUBILA.create({
          data: {
            DNI_AGENTE: dni,
            NOMBRE_AGENTE: nombre,
            APELLIDO_AGENTE: apellido,
            FECHA_NACIMIENTO: fechaNac,
            SECRETARIA: secretaria,
            PROGRAMA: programa,
            CARGO: cargo,
            SEXO: sexo || null,
            ESTADO_ACTIVO: estadoActivo,
            CUIL: cuil,
            NUMERO_TELEFONO: telefono,
            CORREO_ELECTRONICO: correo,
            ID_REGIMEN_JUBILATORIO: idRegimen,
            FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: fechaEstimada,
            EDAD_ESTIMACION_JUBILACION: edadActual,
            ANTIGUEDAD_RECIBO_CALC: '0 Años, 0 Meses, 0 Días',
            ANTIGUEDAD_LICENCIAS_CALC: '0 Años, 0 Meses, 0 Días',
          },
        })
        nuevos.push({
          dni, nombre, apellido,
          secretaria: secretaria ?? '', programa: programa ?? '',
          cargo: cargo ?? '', sexo: sexo ?? '', estadoActivo,
          cuil: cuil ?? '', telefono: telefono ?? '',
          correo: correo ?? '', fechaNacimiento: dateToStr(fechaNac),
        })
        dnisAfectados.push(dni)
      } else {
        const diffs: DiffField[] = []
        const check = (campo: string, anterior: string, nuevo: string) => {
          if (anterior.trim() !== nuevo.trim()) diffs.push({ campo, anterior, nuevo })
        }
        check('NOMBRE_AGENTE', norm(existente.NOMBRE_AGENTE), nombre)
        check('APELLIDO_AGENTE', norm(existente.APELLIDO_AGENTE), apellido)
        // Comparar fechas con UTC para evitar falsos positivos por zona horaria
        check('FECHA_NACIMIENTO', dateToStr(existente.FECHA_NACIMIENTO), dateToStr(fechaNac))
        check('SECRETARIA', norm(existente.SECRETARIA), norm(secretaria))
        check('PROGRAMA', norm(existente.PROGRAMA), norm(programa))
        check('CARGO', norm(existente.CARGO), norm(cargo))
        check('SEXO', norm(existente.SEXO), norm(sexo))
        check('ESTADO_ACTIVO', String(existente.ESTADO_ACTIVO), String(estadoActivo))
        check('CUIL', norm(existente.CUIL), norm(cuil))
        check('NUMERO_TELEFONO', norm(existente.NUMERO_TELEFONO), norm(telefono))
        check('CORREO_ELECTRONICO', norm(existente.CORREO_ELECTRONICO), norm(correo))

        // Siempre recalcular campos derivados (pueden haber cambiado el régimen o fecha nac)
        const updateData: Record<string, unknown> = {
          FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: fechaEstimada,
          EDAD_ESTIMACION_JUBILACION: edadActual,
        }
        if (idRegimen !== null) updateData.ID_REGIMEN_JUBILATORIO = idRegimen

        if (diffs.length > 0) {
          for (const d of diffs) {
            if (d.campo === 'NOMBRE_AGENTE')       updateData.NOMBRE_AGENTE = nombre
            if (d.campo === 'APELLIDO_AGENTE')     updateData.APELLIDO_AGENTE = apellido
            if (d.campo === 'FECHA_NACIMIENTO')    updateData.FECHA_NACIMIENTO = fechaNac
            if (d.campo === 'SECRETARIA')          updateData.SECRETARIA = secretaria
            if (d.campo === 'PROGRAMA')            updateData.PROGRAMA = programa
            if (d.campo === 'CARGO')               updateData.CARGO = cargo
            if (d.campo === 'SEXO')                updateData.SEXO = sexo || null
            if (d.campo === 'ESTADO_ACTIVO')       updateData.ESTADO_ACTIVO = estadoActivo
            if (d.campo === 'CUIL')                updateData.CUIL = cuil
            if (d.campo === 'NUMERO_TELEFONO')     updateData.NUMERO_TELEFONO = telefono
            if (d.campo === 'CORREO_ELECTRONICO')  updateData.CORREO_ELECTRONICO = correo
          }
          await prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({
            where: { DNI_AGENTE: dni },
            data: updateData,
          })
          actualizados.push({ dni, nombre: `${apellido} ${nombre}`.trim(), diffs })
        } else {
          // Sin cambios en campos personales, pero igual actualizamos los derivados
          await prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({
            where: { DNI_AGENTE: dni },
            data: updateData,
          })
          sinCambios++
        }
        dnisAfectados.push(dni)
      }
    } catch (err) {
      errores++
      errorDetails.push(`DNI ${dni}: ${String(err)}`)
    }
  }
  return { nuevos, actualizados, sinCambios, errores, errorDetails, dnisAfectados }
}

// ─────────────────────────────────────────────────────────────────────────────
// Procesamiento Carrera Administrativa
// ─────────────────────────────────────────────────────────────────────────────
async function processCarreraAdministrativa() {
  const rows = readExcel('CarreraAdministrativa.xlsx')
  const nuevas: CarreraNueva[] = []
  const actualizadas: CarreraActualizada[] = []
  let sinCambios = 0; let errores = 0; const errorDetails: string[] = []
  const dnisAfectados = new Set<string>()

  for (const row of rows) {
    const dni = norm(row['EMPLEADO'])
    if (!dni) continue
    try {
      const fechaAlta = parseExcelDate(row['FECHA ALTA'])
      const fechaBaja = parseExcelDate(row['FECHA BAJA'])
      const causaBaja = norm(row['CAUSA BAJA']) || null
      if (!fechaAlta) {
        errores++
        errorDetails.push(`DNI ${dni}: FECHA ALTA inválida`)
        continue
      }

      const agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({
        where: { DNI_AGENTE: dni },
        select: { DNI_AGENTE: true },
      })
      if (!agente) {
        errores++
        errorDetails.push(`DNI ${dni}: agente no encontrado en la base`)
        continue
      }

      // Buscar por FECHA_ALTA exacta (UTC): ventana de ±1 día para tolerar diferencias de hora
      const fechaAltaStart = new Date(fechaAlta)
      fechaAltaStart.setUTCHours(0, 0, 0, 0)
      const fechaAltaEnd = new Date(fechaAlta)
      fechaAltaEnd.setUTCHours(23, 59, 59, 999)

      const existente = await prisma.cARRERA_ADMINISTRATIVA.findFirst({
        where: {
          DOCUMENTO_EMPLEADO: dni,
          FECHA_ALTA: { gte: fechaAltaStart, lte: fechaAltaEnd },
        },
      })

      if (!existente) {
        await prisma.cARRERA_ADMINISTRATIVA.create({
          data: {
            DOCUMENTO_EMPLEADO: dni,
            FECHA_ALTA: fechaAlta,
            FECHA_BAJA: fechaBaja,
            CAUSA_BAJA: causaBaja,
          },
        })
        nuevas.push({
          dni,
          fechaAlta: dateToStr(fechaAlta),
          fechaBaja: dateToStr(fechaBaja),
          causaBaja: causaBaja ?? '',
        })
        dnisAfectados.add(dni)
      } else {
        const diffs: DiffField[] = []
        if (dateToStr(existente.FECHA_BAJA) !== dateToStr(fechaBaja)) {
          diffs.push({ campo: 'FECHA_BAJA', anterior: dateToStr(existente.FECHA_BAJA), nuevo: dateToStr(fechaBaja) })
        }
        if (norm(existente.CAUSA_BAJA) !== norm(causaBaja)) {
          diffs.push({ campo: 'CAUSA_BAJA', anterior: norm(existente.CAUSA_BAJA), nuevo: norm(causaBaja) })
        }
        if (diffs.length > 0) {
          await prisma.cARRERA_ADMINISTRATIVA.update({
            where: { ID_CARRERA: existente.ID_CARRERA },
            data: { FECHA_BAJA: fechaBaja, CAUSA_BAJA: causaBaja },
          })
          actualizadas.push({ dni, fechaAlta: dateToStr(fechaAlta), diffs })
          dnisAfectados.add(dni)
        } else {
          sinCambios++
        }
      }
    } catch (err) {
      errores++
      errorDetails.push(`DNI ${dni}: ${String(err)}`)
    }
  }

  // Tras procesar carrera, recalcular FECHA_ESTIMADA, EDAD y antigüedades para todos los afectados
  for (const dni of dnisAfectados) {
    try {
      await recalcularCamposDerivados(dni)
      await recalcularAntiguedades(dni)
    } catch {
      // No interrumpir el flujo si falla el recálculo de un agente
    }
  }

  return { nuevas, actualizadas, sinCambios, errores, errorDetails }
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler principal
// ─────────────────────────────────────────────────────────────────────────────
export async function POST() {
  try {
    // Ejecución secuencial para evitar contención en el pool y bloqueos de DB
    const dpData = await processDatosPersonales()
    const caData = await processCarreraAdministrativa()
    const lastUpdated = nowStr()

    // Recalcular antigüedades para agentes afectados solo por DatosPersonales
    // (los afectados por Carrera ya se recalcularon dentro de processCarreraAdministrativa)
    const carreraDnis = new Set([
      ...caData.nuevas.map((c) => c.dni),
      ...caData.actualizadas.map((c) => c.dni),
    ])
    for (const dni of dpData.dnisAfectados) {
      if (!carreraDnis.has(dni)) {
        try {
          await recalcularAntiguedades(dni)
        } catch {
          // No interrumpir el flujo
        }
      }
    }

    return NextResponse.json({
      ok: true,
      lastUpdated,
      datosPersonales: dpData,
      carreraAdministrativa: caData,
    })
  } catch (err) {
    console.error('[bulk-sync] Error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
