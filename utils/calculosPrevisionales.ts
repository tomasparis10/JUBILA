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

type IntervaloDias = { inicio: number; fin: number }

/** Une períodos iguales o superpuestos para no contar antigüedad dos veces. */
function unirIntervalos(intervalos: IntervaloDias[]): IntervaloDias[] {
  const ordenados = intervalos
    .filter(({ inicio, fin }) => inicio < fin)
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin)
  const unidos: IntervaloDias[] = []

  for (const intervalo of ordenados) {
    const ultimo = unidos[unidos.length - 1]
    if (!ultimo || intervalo.inicio > ultimo.fin) {
      unidos.push({ ...intervalo })
    } else {
      ultimo.fin = Math.max(ultimo.fin, intervalo.fin)
    }
  }

  return unidos
}

function intervalosDeFases(fases: FaseCarrera[], limite: Date): IntervaloDias[] {
  const limiteMs = Date.UTC(limite.getUTCFullYear(), limite.getUTCMonth(), limite.getUTCDate())
  return unirIntervalos(
    fases
      .filter((fase): fase is FaseCarrera & { FECHA_ALTA: Date } => Boolean(fase.FECHA_ALTA))
      .map((fase) => {
        const alta = new Date(fase.FECHA_ALTA)
        const baja = fase.FECHA_BAJA ? new Date(fase.FECHA_BAJA) : limite
        const inicio = Date.UTC(alta.getUTCFullYear(), alta.getUTCMonth(), alta.getUTCDate())
        const fin = Math.min(
          Date.UTC(baja.getUTCFullYear(), baja.getUTCMonth(), baja.getUTCDate()),
          limiteMs,
        )
        return { inicio, fin }
      }),
  )
}

// ---------------------------------------------------------------------------
// A. Antiguedad Recibo
// ---------------------------------------------------------------------------

/**
 * Calcula la antigüedad total sumando los días de cada fase de CARRERA_ADMINISTRATIVA.
 *
 * - Si FECHA_BAJA es null → fase activa → se usa la fecha actual como límite.
 * - Si FECHA_ALTA es null → la fase se ignora.
 * - Si el array está vacío → devuelve "0 Años, 0 Meses, 0 Días".
 */
export function calcAntiguedadRecibo(
  fases: FaseCarrera[],
  _fechaJubilacion?: Date | null,
): string {
  if (!fases || fases.length === 0) return '0 Años, 0 Meses, 0 Días'

  return formatDias(calcDiasAportes(fases, new Date()))
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
  const intervalos = intervalosDeFases(
    fases.filter((fase) => fase.FECHA_ALTA && new Date(fase.FECHA_ALTA) < inicioAnio2026),
    CORTE_LICENCIAS,
  )
  let totalDias = 0
  const fechaJubilacionMs = fechaJubilacion && fechaJubilacion < CORTE_LICENCIAS
    ? Date.UTC(fechaJubilacion.getUTCFullYear(), fechaJubilacion.getUTCMonth(), fechaJubilacion.getUTCDate())
    : null

  for (const intervalo of intervalos) {
    if (fechaJubilacionMs == null) {
      totalDias += Math.floor((intervalo.fin - intervalo.inicio) / (1000 * 60 * 60 * 24))
      continue
    }

    const finRegular = Math.min(intervalo.fin, fechaJubilacionMs)
    if (intervalo.inicio < finRegular) {
      totalDias += Math.floor((finRegular - intervalo.inicio) / (1000 * 60 * 60 * 24))
    }
    if (intervalo.fin > fechaJubilacionMs) {
      const inicioExcedente = Math.max(intervalo.inicio, fechaJubilacionMs)
      const diasExcedente = Math.floor((intervalo.fin - inicioExcedente) / (1000 * 60 * 60 * 24))
      totalDias += Math.floor(diasExcedente / 2)
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

/** Suma días de aportes reales hasta una fecha, sin duplicar fases superpuestas. */
export function calcDiasAportes(fases: FaseCarrera[], hasta: Date): number {
  const limite = Date.UTC(hasta.getUTCFullYear(), hasta.getUTCMonth(), hasta.getUTCDate())
  const intervalos = fases
    .filter((fase): fase is FaseCarrera & { FECHA_ALTA: Date } => Boolean(fase.FECHA_ALTA))
    .map((fase) => {
      const alta = new Date(fase.FECHA_ALTA)
      const baja = fase.FECHA_BAJA ? new Date(fase.FECHA_BAJA) : hasta
      const inicio = Date.UTC(alta.getUTCFullYear(), alta.getUTCMonth(), alta.getUTCDate())
      const finOriginal = Date.UTC(baja.getUTCFullYear(), baja.getUTCMonth(), baja.getUTCDate())
      return { inicio, fin: Math.min(finOriginal, limite) }
    })
    .filter(({ inicio, fin }) => inicio < fin)
    .sort((a, b) => a.inicio - b.inicio)

  let totalDias = 0
  let inicioActual: number | null = null
  let finActual = 0

  for (const intervalo of intervalos) {
    if (inicioActual == null) {
      inicioActual = intervalo.inicio
      finActual = intervalo.fin
    } else if (intervalo.inicio <= finActual) {
      finActual = Math.max(finActual, intervalo.fin)
    } else {
      totalDias += Math.floor((finActual - inicioActual) / (1000 * 60 * 60 * 24))
      inicioActual = intervalo.inicio
      finActual = intervalo.fin
    }
  }

  if (inicioActual != null) {
    totalDias += Math.floor((finActual - inicioActual) / (1000 * 60 * 60 * 24))
  }
  return totalDias
}

function addYearsUTC(fecha: Date, anos: number): Date {
  const year = fecha.getUTCFullYear() + anos
  const month = fecha.getUTCMonth()
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(fecha.getUTCDate(), maxDay)))
}

/** Edad (en años) a la que corresponde la jubilación por edad avanzada. */
const EDAD_AVANZADA = 70

/** Indica si al cumplir 70 años el agente no supera los 10 años de aportes. */
export function noCumpleAportesEdadAvanzada(
  fechaNacimiento: Date | null | undefined,
  fases: FaseCarrera[],
): boolean {
  if (!fechaNacimiento) return false
  const fechaEdadAvanzada = addYearsUTC(new Date(fechaNacimiento), EDAD_AVANZADA)
  return calcDiasAportes(fases, fechaEdadAvanzada) <= 10 * 365
}

/**
 * Obtiene la primera fecha en que se cumplen edad y aportes del régimen.
 * Los aportes reales se computan solamente hasta la fecha en que se alcanza la
 * edad requerida. Desde allí, cada dos días de edad excedente compensan un día
 * faltante, sin sumar por separado nuevos días trabajados.
 *
 * Regla de edad avanzada: si la fecha resultante supera el 70° cumpleaños del
 * agente, la estimación se trunca a la fecha en que cumple 70 años.
 */
export function calcFechaEstimadaJubilacion(
  fechaNacimiento: Date | null | undefined,
  edadRequerida: number | null | undefined,
  anosAportesRequeridos: number | null | undefined,
  fases: FaseCarrera[],
): Date | null {
  if (!fechaNacimiento || edadRequerida == null || anosAportesRequeridos == null) return null
  if (edadRequerida < 0 || anosAportesRequeridos < 0) return null

  const fechaEdadRequerida = addYearsUTC(new Date(fechaNacimiento), edadRequerida)
  const aportesRequeridos = anosAportesRequeridos * 365
  const MS_POR_DIA = 1000 * 60 * 60 * 24
  const aportesAlCumplirEdad = calcDiasAportes(fases, fechaEdadRequerida)
  const aportesFaltantes = Math.max(0, aportesRequeridos - aportesAlCumplirEdad)

  const fechaCalculada = new Date(fechaEdadRequerida.getTime() + aportesFaltantes * 2 * MS_POR_DIA)
  const fechaEdadAvanzada = addYearsUTC(new Date(fechaNacimiento), EDAD_AVANZADA)

  return fechaCalculada > fechaEdadAvanzada ? fechaEdadAvanzada : fechaCalculada
}

/** Calcula los años completos cumplidos por una persona en una fecha dada. */
export function calcEdadEnFecha(fechaNacimiento: Date, fechaEvaluada: Date): number {
  const nacimiento = new Date(fechaNacimiento)
  const evaluada = new Date(fechaEvaluada)
  let edad = evaluada.getUTCFullYear() - nacimiento.getUTCFullYear()
  const aunNoCumplio = evaluada.getUTCMonth() < nacimiento.getUTCMonth()
    || (evaluada.getUTCMonth() === nacimiento.getUTCMonth()
      && evaluada.getUTCDate() < nacimiento.getUTCDate())
  if (aunNoCumplio) edad--
  return edad
}
