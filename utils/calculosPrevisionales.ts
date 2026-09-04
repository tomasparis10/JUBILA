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
  const iniMs = Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate())
  const finMs = Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate())
  return Math.max(0, Math.floor((finMs - iniMs) / MS_POR_DIA))
}

// ---------------------------------------------------------------------------
// A. Antiguedad Recibo (con factor excedente)
// ---------------------------------------------------------------------------

/**
 * Calcula la antigüedad total sumando los días de cada fase de CARRERA_ADMINISTRATIVA.
 *
 * Regla de excedente: si se proporciona `fechaJubilacion` y el agente trabajó
 * después de esa fecha, los días de excedente se cuentan al 50% (/ 2).
 *
 * - Si FECHA_BAJA es null → fase activa → se usa la fecha actual como límite.
 * - Si FECHA_ALTA es null → la fase se ignora.
 * - Si el array está vacío → devuelve "0 Años, 0 Meses, 0 Días".
 */
export function calcAntiguedadRecibo(
  fases: FaseCarrera[],
  fechaJubilacion?: Date | null,
): string {
  if (!fases || fases.length === 0) return '0 Años, 0 Meses, 0 Días'

  const hoy = new Date()
  let totalDias = 0

  for (const fase of fases) {
    if (!fase.FECHA_ALTA) continue

    const inicio = new Date(fase.FECHA_ALTA)
    const fin    = fase.FECHA_BAJA ? new Date(fase.FECHA_BAJA) : hoy

    if (fechaJubilacion) {
      // ── Parte regular: inicio → min(fin, fechaJubilacion) ──────────────────
      const corte = new Date(Math.min(fin.getTime(), fechaJubilacion.getTime()))
      if (inicio < corte) {
        totalDias += difEnDias(inicio, corte)
      }
      // ── Parte excedente: fechaJubilacion → fin (si lo supera) ──────────────
      if (fin > fechaJubilacion) {
        const inicioExcedente = inicio > fechaJubilacion ? inicio : fechaJubilacion
        const diasExcedente = difEnDias(inicioExcedente, fin)
        totalDias += Math.floor(diasExcedente / 2)
      }
    } else {
      // Sin fecha de jubilación: contar todo completo
      totalDias += difEnDias(inicio, fin)
    }
  }

  return formatDias(totalDias)
}

// ---------------------------------------------------------------------------
// B. Antiguedad Licencias (corte al 31/12/2025 + factor excedente)
// ---------------------------------------------------------------------------

/** Fecha de corte para el cálculo de Antigüedad Licencias */
const CORTE_LICENCIAS = new Date(Date.UTC(2025, 11, 31)) // 31/12/2025 UTC

/**
 * Calcula la antigüedad con corte estricto al 31/12/2025.
 *
 * Regla de excedente: si se proporciona `fechaJubilacion` y ésta es anterior
 * al corte, los días entre `fechaJubilacion` y el corte (31/12/2025) se
 * cuentan al 50% (/ 2).
 *
 * Reglas de corte:
 *   1. Si FECHA_ALTA es null → la fase se ignora.
 *   2. Si FECHA_ALTA >= 01/01/2026 → la fase se ignora.
 *   3. El límite máximo para cualquier fase es 31/12/2025.
 */
export function calcAntiguedadLicencias(
  fases: FaseCarrera[],
  fechaJubilacion?: Date | null,
): string {
  if (!fases || fases.length === 0) return '0 Años, 0 Meses, 0 Días'

  const inicioAnio2026 = new Date(Date.UTC(2026, 0, 1)) // 01/01/2026 UTC
  let totalDias = 0

  for (const fase of fases) {
    if (!fase.FECHA_ALTA) continue

    const inicio = new Date(fase.FECHA_ALTA)
    if (inicio >= inicioAnio2026) continue // Fase iniciada en 2026 o después → ignorar

    // El fin de la fase nunca supera el corte de licencias
    const finRaw = fase.FECHA_BAJA ? new Date(fase.FECHA_BAJA) : CORTE_LICENCIAS
    const fin    = finRaw > CORTE_LICENCIAS ? CORTE_LICENCIAS : finRaw

    if (fechaJubilacion && fechaJubilacion < CORTE_LICENCIAS) {
      // ── Parte regular: inicio → min(fin, fechaJubilacion) ──────────────────
      const corte = new Date(Math.min(fin.getTime(), fechaJubilacion.getTime()))
      if (inicio < corte) {
        totalDias += difEnDias(inicio, corte)
      }
      // ── Parte excedente: fechaJubilacion → fin (dentro del corte) ──────────
      if (fin > fechaJubilacion) {
        const inicioExcedente = inicio > fechaJubilacion ? inicio : fechaJubilacion
        const diasExcedente = difEnDias(inicioExcedente, fin)
        totalDias += Math.floor(diasExcedente / 2)
      }
    } else {
      // Sin fecha de jubilación (o ya posterior al corte): contar todo completo
      totalDias += difEnDias(inicio, fin)
    }
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
