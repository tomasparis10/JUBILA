/**
 * lib/bulk-sync/normalizers.ts
 *
 * Funciones puras de normalización para la importación desde Excel.
 * Todas son testeables de manera independiente (sin dependencias externas).
 *
 * REGLA: ante ambigüedad, devolver null y dejar que el caller decida el error.
 * NUNCA asignar un valor por defecto cuando el dato real es desconocido.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte a string, hace trim y colapsa espacios múltiples. */
function toStr(v: unknown): string {
  return String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

/** Elimina acentos/tildes de una cadena. */
function removeAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeDni
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza un valor de DNI proveniente de Excel.
 *
 * - Elimina espacios y puntos
 * - Elimina el sufijo ".0" que Excel puede agregar al interpretar como número
 * - Valida que sea un número razonable (6 a 9 dígitos)
 * - Devuelve el DNI como string limpio, o null si no es válido
 */
export function normalizeDni(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  let raw = toStr(value)

  // Si viene como número decimal de Excel (ej. "12345678.0")
  raw = raw.replace(/\.0+$/, '')

  // Eliminar separadores de miles: puntos y comas
  raw = raw.replace(/[.,]/g, '')

  // Eliminar espacios restantes
  raw = raw.replace(/\s/g, '')

  // Validar que sean solo dígitos
  if (!/^\d+$/.test(raw)) return null

  // Validar rango razonable para DNI argentino (6 a 9 dígitos)
  if (raw.length < 6 || raw.length > 9) return null

  return raw
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeSexo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza el campo SEXO al valor canónico 'Masculino' | 'Femenino'.
 *
 * Reconoce variantes en mayúsculas/minúsculas y abreviaciones comunes.
 * Si el valor está vacío o no puede determinarse: devuelve null.
 * NUNCA asume un sexo por defecto.
 */
export function normalizeSexo(value: unknown): 'Masculino' | 'Femenino' | null {
  if (value === null || value === undefined || value === '') return null

  const s = removeAccents(toStr(value)).toUpperCase()

  if (s === 'M' || s === 'MASCULINO' || s === 'HOMBRE' || s === 'MASC') {
    return 'Masculino'
  }

  if (s === 'F' || s === 'FEMENINO' || s === 'MUJER' || s === 'FEM') {
    return 'Femenino'
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeRegimen
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza el nombre del régimen jubilatorio al nombre canónico de la tabla diccionario.
 *
 * Regímenes reconocidos:
 *   - 'DOCENTES'
 *   - 'REGIMEN GENERAL'
 *   - 'REGIMEN DIFERENCIAL DE SALUD'
 *   - 'UNICO REGIMEN'
 *
 * Maneja:
 *   - Prefijos PASIVISADOS / PASIVIZADOS / PAV (son condiciones, no regímenes distintos)
 *   - Acentos y diferencias de mayúsculas
 *   - Variantes de puntuación en "SALUD - SERV.DIF.ART.18 LEY 9504"
 *
 * Si el régimen no puede determinarse con seguridad: devuelve null.
 * NUNCA asigna un régimen por defecto.
 *
 * IMPORTANTE: el orden de evaluación importa para evitar clasificaciones incorrectas.
 */
export function normalizeRegimen(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  // Normalizar: sin acentos, sin espacios repetidos, mayúsculas, sin puntos en separadores
  let s = removeAccents(toStr(value)).toUpperCase().replace(/\s+/g, ' ')

  // Eliminar prefijos de condición PASIVISADOS / PASIVIZADOS / PAV
  // Pueden aparecer al inicio seguidos de " - " o " "
  s = s
    .replace(/^PASIVISADOS\s*-\s*/i, '')
    .replace(/^PASIVIZADOS\s*-\s*/i, '')
    .replace(/^PAV\s*-\s*/i, '')
    .trim()

  // Eliminar el prefijo nuevamente si quedó anidado (doble prefijo edge case)
  s = s
    .replace(/^PASIVISADOS\s*-\s*/i, '')
    .replace(/^PASIVIZADOS\s*-\s*/i, '')
    .replace(/^PAV\s*-\s*/i, '')
    .trim()

  // ── Evaluación ordenada (más específico primero) ───────────────────────────

  // 1. RÉGIMEN DIFERENCIAL DE SALUD
  //    Reconoce: "SALUD", "SALUD - SERV.DIF.ART.18 LEY 9504", etc.
  //    IMPORTANTE: evaluar antes de DOCENTES para evitar conflictos
  if (s.includes('SALUD')) {
    return 'REGIMEN DIFERENCIAL DE SALUD'
  }

  // 2. DOCENTES
  //    Reconoce: "DOCENTES", "DOCENTE" (singular)
  if (s.includes('DOCENT')) {
    return 'DOCENTES'
  }

  // 3. ÚNICO RÉGIMEN
  //    Reconoce: "UNICO REGIMEN", "ÚNICO RÉGIMEN"
  if (s.includes('UNICO') && s.includes('REGIMEN')) {
    return 'UNICO REGIMEN'
  }

  // 4. RÉGIMEN GENERAL
  //    Reconoce: "REGIMEN GENERAL", "RÉGIMEN GENERAL"
  //    IMPORTANTE: evaluar al final porque "GENERAL" es muy genérico
  if (s.includes('REGIMEN') && s.includes('GENERAL')) {
    return 'REGIMEN GENERAL'
  }

  // No reconocido
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeDate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Convierte cualquier representación de fecha de Excel a Date UTC o null.
 *
 * Soporta:
 *   - Número serial de Excel (días desde 30/12/1899)
 *   - String 'dd/mm/yyyy'
 *   - String 'yyyy-mm-dd'
 *   - Objeto Date nativo
 *
 * SIEMPRE construye con Date.UTC() para evitar desplazamiento de zona horaria.
 * Las fechas son administrativas: 01/08/2026 debe permanecer 01/08/2026.
 */
export function normalizeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null

  // Número serial de Excel
  if (typeof value === 'number') {
    if (value <= 0) return null
    return excelSerialToUTC(value)
  }

  // Objeto Date (cuando cellDates: true)
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    // Reconstruir en UTC usando partes UTC del Date que devolvió XLSX
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
  }

  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null

    // dd/mm/yyyy o d/m/yyyy
    const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (dmy) {
      return buildStrictUTCDate(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]))
    }

    // yyyy-mm-dd
    const ymd = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (ymd) {
      return buildStrictUTCDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
    }
  }

  return null
}

function buildStrictUTCDate(year: number, month: number, day: number): Date | null {
  const d = new Date(Date.UTC(year, month - 1, day))
  if (isNaN(d.getTime())) return null
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
    ? d
    : null
}

/** Las fechas de alta de 1899/1900 son valores irrisorios de Excel, no fases reales. */
export function isIrrationalAltaDate(date: Date): boolean {
  return date.getUTCFullYear() <= 1900
}

/** Convierte número serial de Excel a Date UTC.
 *
 * Excel tiene un bug heredado de Lotus 1-2-3: considera que 1900 fue bisiesto.
 * El serial 60 representa el inexistente 29/02/1900; lo llevamos al 28/02/1900
 * y corregimos los seriales posteriores sin tocar fechas modernas.
 */
function excelSerialToUTC(serial: number): Date {
  const MS_POR_DIA = 86_400_000
  const epoch = Date.UTC(1899, 11, 31)
  const correctedSerial = serial > 59 ? serial - 1 : serial
  return new Date(epoch + Math.round(correctedSerial * MS_POR_DIA))
}

// ─────────────────────────────────────────────────────────────────────────────
// normalizeEstadoActivo
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normaliza el campo ESTADO_ACTIVO.
 * Acepta: 'ACTIVO', 'SI', '1', 'TRUE', 'INACTIVO', 'NO', '0', 'FALSE', etc.
 */
export function normalizeEstadoActivo(value: unknown): boolean {
  const s = removeAccents(toStr(value)).toUpperCase()
  if (s === 'ACTIVO' || s === 'SI' || s === '1' || s === 'TRUE' || s === 'ALTA') return true
  if (s === 'INACTIVO' || s === 'NO' || s === '0' || s === 'FALSE' || s === 'BAJA') return false
  // Por defecto conservador: si el campo dice algo irreconocible, asumir activo
  // (es más seguro que marcar como inactivo a alguien que debería estar activo)
  return true
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formato para mostrar en UI / comparaciones
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Formatea un Date a 'dd/mm/yyyy' usando componentes UTC.
 * Devuelve '' si es null/undefined.
 */
export function dateToStr(d: Date | null | undefined): string {
  if (!d) return ''
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

/**
 * Normaliza un string para comparación semántica:
 * trim + colapso de espacios + uppercase.
 */
export function normStr(v: unknown): string {
  return toStr(v).toUpperCase()
}

/**
 * Compara dos valores como "vacío" de manera semántica.
 * null, undefined, '' y '  ' son equivalentes.
 */
export function eqEmpty(a: unknown, b: unknown): boolean {
  return !toStr(a) && !toStr(b)
}
