/**
 * utils/calculosPrevisionales.ts
 *
 * Funciones puras para calcular antiguedad previsional y fecha estimada
 * de jubilacion a partir de los registros de CARRERA_ADMINISTRATIVA.
 *
 * Reglas de conversion de tiempo:
 *   - 1 ano  = 365 dias
 *   - 1 mes  = 30 dias
 *
 * Regla de CERO MOCKS:
 *   - Si el agente no tiene fases -> "0 Anos, 0 Meses, 0 Dias"
 *   - Si falta fechaNacimiento -> null
 */

/** Representa una fase de CARRERA_ADMINISTRATIVA */
export interface FaseCarrera {
  FECHA_ALTA: Date | null
  FECHA_BAJA: Date | null
}

// ---------------------------------------------------------------------------
// Helper interno
// ---------------------------------------------------------------------------

/**
 * Convierte un total de dias en un string "X Anos, Y Meses, Z Dias".
 * Usa anos de 365 dias y meses de 30 dias.
 */
export function formatDias(totalDias: number): string {
  if (totalDias <= 0) return '0 Años, 0 Meses, 0 Días'

  const anos = Math.floor(totalDias / 365)
  const diasRestantes = totalDias % 365
  const meses = Math.floor(diasRestantes / 30)
  const dias = diasRestantes % 30

  return `${anos} Año${anos !== 1 ? 's' : ''}, ${meses} Mes${meses !== 1 ? 'es' : ''}, ${dias} Día${dias !== 1 ? 's' : ''}`
}

/** Calcula la diferencia en dias completos entre dos fechas (fin - inicio). */
function difEnDias(inicio: Date, fin: Date): number {
  const MS_POR_DIA = 1000 * 60 * 60 * 24
  // Normalizar a medianoche UTC para evitar problemas de DST
  const iniMs = Date.UTC(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  const finMs = Date.UTC(fin.getFullYear(), fin.getMonth(), fin.getDate())
  return Math.max(0, Math.floor((finMs - iniMs) / MS_POR_DIA))
}

// ---------------------------------------------------------------------------
// A. Antiguedad Recibo (total a hoy)
// ---------------------------------------------------------------------------

/**
 * Calcula la antiguedad total sumando los dias de cada fase de CARRERA_ADMINISTRATIVA.
 *
 * - Si FECHA_BAJA es null -> la fase esta activa -> se usa la fecha actual como limite.
 * - Si FECHA_ALTA es null -> la fase se ignora.
 * - Si el array de fases esta vacio -> devuelve "0 Anos, 0 Meses, 0 Dias".
 */
export function calcAntiguedadRecibo(fases: FaseCarrera[]): string {
  if (!fases || fases.length === 0) return '0 Años, 0 Meses, 0 Días'

  const hoy = new Date()
  let totalDias = 0

  for (const fase of fases) {
    if (!fase.FECHA_ALTA) continue

    const inicio = new Date(fase.FECHA_ALTA)
    const fin = fase.FECHA_BAJA ? new Date(fase.FECHA_BAJA) : hoy

    totalDias += difEnDias(inicio, fin)
  }

  return formatDias(totalDias)
}

// ---------------------------------------------------------------------------
// B. Antiguedad Licencias (corte al 31/12/2025)
// ---------------------------------------------------------------------------

/** Fecha de corte para el calculo de Antiguedad Licencias */
const CORTE_LICENCIAS = new Date(2025, 11, 31) // 31 de diciembre de 2025

/**
 * Calcula la antiguedad con corte estricto al 31/12/2025.
 *
 * Reglas:
 *   1. Si FECHA_ALTA es null -> la fase se ignora.
 *   2. Si FECHA_ALTA >= 01/01/2026 -> la fase se ignora completamente.
 *   3. Si FECHA_BAJA es null o > 31/12/2025 -> se usa 31/12/2025 como limite.
 *   4. Si FECHA_BAJA <= 31/12/2025 -> se calcula normal.
 *   5. Si el array de fases esta vacio -> devuelve "0 Anos, 0 Meses, 0 Dias".
 */
export function calcAntiguedadLicencias(fases: FaseCarrera[]): string {
  if (!fases || fases.length === 0) return '0 Años, 0 Meses, 0 Días'

  const inicioAnio2026 = new Date(2026, 0, 1) // 01/01/2026

  let totalDias = 0

  for (const fase of fases) {
    if (!fase.FECHA_ALTA) continue

    const inicio = new Date(fase.FECHA_ALTA)

    // Regla 2: Si la fase empezo en 2026 o despues -> ignorar
    if (inicio >= inicioAnio2026) continue

    // Determinar el limite de fin para esta fase
    let fin: Date
    if (!fase.FECHA_BAJA) {
      // Fase activa -> corte al 31/12/2025
      fin = CORTE_LICENCIAS
    } else {
      const fechaBaja = new Date(fase.FECHA_BAJA)
      // Si termino despues del corte -> usar el corte
      fin = fechaBaja > CORTE_LICENCIAS ? CORTE_LICENCIAS : fechaBaja
    }

    totalDias += difEnDias(inicio, fin)
  }

  return formatDias(totalDias)
}

// ---------------------------------------------------------------------------
// C. Fecha Estimada de Jubilacion
// ---------------------------------------------------------------------------

/**
 * Calcula la fecha exacta en que el agente cumple `edadRequerida` anos.
 *
 * @param fechaNacimiento - Fecha de nacimiento del agente
 * @param edadRequerida  - Edad requerida segun el regimen jubilatorio
 * @returns Date exacta del cumpleanos correspondiente, o null si faltan datos
 */
export function calcFechaJubilacion(
  fechaNacimiento: Date | null | undefined,
  edadRequerida: number | null | undefined,
): Date | null {
  if (!fechaNacimiento || edadRequerida == null) return null

  const nac = new Date(fechaNacimiento)
  // La fecha de jubilacion es el cumpleanos numero edadRequerida
  const fechaJubilacion = new Date(
    nac.getFullYear() + edadRequerida,
    nac.getMonth(),
    nac.getDate(),
  )

  return fechaJubilacion
}
