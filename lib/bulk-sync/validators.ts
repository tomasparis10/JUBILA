/**
 * lib/bulk-sync/validators.ts
 *
 * Validación de archivos Excel y lectura desde Buffer.
 *
 * Responsabilidades:
 * - Verificar tipo/extensión de archivo
 * - Verificar que el Excel no esté corrupto
 * - Verificar que las columnas obligatorias estén presentes
 * - Tolerar espacios accidentales en nombres de columnas
 * - Leer filas como objetos con headers normalizados
 */

import * as XLSX from 'xlsx'

// ─────────────────────────────────────────────────────────────────────────────
// Columnas obligatorias por archivo
// ─────────────────────────────────────────────────────────────────────────────

const DP_REQUIRED_COLUMNS = [
  'NOMBRE_REGIMEN',
  'DNI_AGENTE',
  'NOMBRE_AGENTE',
  'APELLIDO_AGENTE',
  'FECHA_NACIMIENTO',
  'SEXO',
  'ESTADO_ACTIVO',
] as const

const CA_REQUIRED_COLUMNS = [
  'EMPLEADO',
  'FECHA ALTA',
] as const

// ─────────────────────────────────────────────────────────────────────────────
// Tipos locales
// ─────────────────────────────────────────────────────────────────────────────

export interface ExcelParseResult {
  ok: boolean
  headers: string[]
  rows: Record<string, unknown>[]
  error?: string
}

export interface ColumnValidation {
  ok: boolean
  missing: string[]
}

const DATE_COLUMNS = new Set([
  'FECHA_NACIMIENTO',
  'FECHA ALTA',
  'FECHA BAJA',
])

type ExcelDateCode = { y: number; m: number; d: number }
type ExcelCell = { v?: unknown; t?: string; z?: string }

/**
 * Obtiene la fecha de una celda serializada sin crear un Date de JavaScript.
 * Excel puede guardar la hora como 23:59:xx; convertir ese valor a Date en un
 * servidor UTC-3 lo lleva al día anterior. parse_date_code trabaja solo con
 * las partes del calendario y evita ese desplazamiento.
 */
function excelSerialToDisplayedDate(value: number, format: string | undefined, date1904: boolean): string | null {
  if (!Number.isFinite(value) || value <= 0) return null

  const code = (XLSX.SSF as unknown as {
    parse_date_code: (serial: number, options?: { date1904?: boolean }) => ExcelDateCode | null
  }).parse_date_code(Math.round(value), { date1904 })
  if (!code || code.y < 1900 || code.y > 2100) return null

  // Conserva el orden de la máscara del Excel. Para el archivo actual m/d/yy
  // produce 10/4/69 y 5/11/81, que luego normalizeDate interpreta como DD/MM.
  const tokens = (format ?? '').match(/d{1,4}|m{1,4}|y{2,4}/gi) ?? []
  const values: Record<string, string> = {
    d: String(code.d),
    dd: String(code.d).padStart(2, '0'),
    m: String(code.m),
    mm: String(code.m).padStart(2, '0'),
    yy: String(code.y).slice(-2),
    yyyy: String(code.y),
  }
  const dateTokens = tokens.filter((token) => /^[dmy]+$/i.test(token.toLowerCase()))
  if (dateTokens.length >= 3) {
    return dateTokens.slice(0, 3).map((token) => values[token.toLowerCase()] ?? '').join('/')
  }

  return `${String(code.m).padStart(2, '0')}/${String(code.d).padStart(2, '0')}/${code.y}`
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '').trim().toUpperCase()
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de tipo de archivo
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = ['.xlsx', '.xls']
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024 // 50 MB

/**
 * Valida que el archivo tenga extensión y tamaño aceptables.
 * NO confía solo en el MIME type del navegador.
 */
export function validateFileMetadata(
  filename: string,
  sizeBytes: number,
): { ok: boolean; error?: string } {
  const lower = filename.toLowerCase()
  const hasValidExt = ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext))
  if (!hasValidExt) {
    return { ok: false, error: `El archivo "${filename}" no es un Excel válido (.xlsx o .xls).` }
  }
  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `El archivo "${filename}" supera el tamaño máximo permitido (50 MB).`,
    }
  }
  if (sizeBytes === 0) {
    return { ok: false, error: `El archivo "${filename}" está vacío.` }
  }
  return { ok: true }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lectura del buffer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lee un Buffer de Excel y devuelve headers + filas.
 *
 * ESTRATEGIA DE FECHAS (decisión del usuario — dd/mm/aaaa):
 * - Las celdas numéricas de fecha se convierten desde el serial Excel usando
 *   parse_date_code, sin pasar por Date ni por zona horaria. Esto conserva el
 *   día que muestra Excel aunque la celda tenga una hora interna 23:59:xx.
 * - Las fechas textuales se conservan como texto y normalizeDate las interpreta
 *   como DD/MM/AAAA.
 * - Resultado: la fecha guardada es EXACTAMENTE la que se ve en la celda,
 *   expresada en dd/mm/aaaa, sin desplazamientos de zona horaria (Date.UTC).
 *
 * NOTA sobre DatosPersonales.xlsx:
 * El archivo real tiene headers en fila 2 (índice 1, base 0), con fila 0 como título.
 * Detectamos esto automáticamente: si la primera fila tiene solo 1 o 2 celdas no vacías,
 * intentamos la siguiente como headers.
 */
export function readExcelBuffer(buffer: Buffer): ExcelParseResult {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, cellNF: true })
  } catch {
    return { ok: false, headers: [], rows: [], error: 'El archivo Excel está corrupto o tiene un formato no compatible.' }
  }

  if (!workbook.SheetNames.length) {
    return { ok: false, headers: [], rows: [], error: 'El archivo Excel no contiene hojas de cálculo.' }
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1, raw: true }) as unknown[][]

  if (!raw || raw.length === 0) {
    return { ok: false, headers: [], rows: [], error: 'La hoja de cálculo está vacía.' }
  }

  // Detectar fila de headers: buscar la primera fila con más de 2 celdas no vacías
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const row = raw[i] as unknown[]
    const nonEmpty = row.filter((c) => c !== null && c !== undefined && String(c).trim() !== '').length
    if (nonEmpty >= 3) {
      headerRowIndex = i
      break
    }
  }

  const headerRow = (raw[headerRowIndex] as unknown[]).map((h) =>
    String(h ?? '').trim(),
  )

  const date1904 = Boolean(workbook.Workbook?.WBProps?.date1904)

  const dataRows: Record<string, unknown>[] = []
  for (let i = headerRowIndex + 1; i < raw.length; i++) {
    const row = raw[i] as unknown[]

    // Ignorar filas completamente vacías
    const allEmpty = row.every(
      (cell) => cell === null || cell === undefined || String(cell).trim() === '',
    )
    if (allEmpty) continue

    const obj: Record<string, unknown> = {}
    headerRow.forEach((h, idx) => {
      const cell = row[idx] as ExcelCell | unknown
      const header = normalizeHeader(h)
      if (DATE_COLUMNS.has(header) && typeof cell === 'number') {
        obj[h] = excelSerialToDisplayedDate(cell, undefined, date1904) ?? ''
      } else {
        obj[h] = cell ?? ''
      }
    })
    dataRows.push(obj)
  }

  if (dataRows.length === 0) {
    return { ok: false, headers: headerRow, rows: [], error: 'El archivo no contiene filas de datos (solo encabezados).' }
  }

  return { ok: true, headers: headerRow, rows: dataRows }
}

// ─────────────────────────────────────────────────────────────────────────────
// Validación de columnas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Valida que todas las columnas obligatorias de DatosPersonales estén presentes.
 * Tolera espacios accidentales (ya resueltos en readExcelBuffer).
 */
export function validateDatosPersonalesColumns(headers: string[]): ColumnValidation {
  const normalized = headers.map((h) => h.toUpperCase().trim())
  const missing = DP_REQUIRED_COLUMNS.filter(
    (col) => !normalized.includes(col.toUpperCase()),
  )
  return { ok: missing.length === 0, missing }
}

/**
 * Valida que todas las columnas obligatorias de CarreraAdministrativa estén presentes.
 */
export function validateCarreraColumns(headers: string[]): ColumnValidation {
  const normalized = headers.map((h) => h.toUpperCase().trim())
  const missing = CA_REQUIRED_COLUMNS.filter(
    (col) => !normalized.includes(col.toUpperCase()),
  )
  return { ok: missing.length === 0, missing }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: obtener valor de fila con nombre de columna case-insensitive
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Obtiene el valor de una columna de una fila, buscando de forma
 * case-insensitive para tolerar variaciones menores.
 */
export function getCol(row: Record<string, unknown>, colName: string): unknown {
  // Primero intentar coincidencia exacta
  if (colName in row) return row[colName]

  // Luego case-insensitive
  const upper = colName.toUpperCase()
  for (const key of Object.keys(row)) {
    if (key.toUpperCase() === upper) return row[key]
  }

  return ''
}
