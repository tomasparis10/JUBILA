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
 * Comportamiento:
 * - La primera fila (índice 0) se usa como headers
 * - Las filas completamente vacías al final se ignoran
 * - cellDates: false → recibimos números seriales, los parseamos con UTC en normalizers
 *
 * NOTA sobre DatosPersonales.xlsx:
 * El archivo real tiene headers en fila 2 (índice 1, base 0), con fila 0 como título.
 * Detectamos esto automáticamente: si la primera fila tiene solo 1 o 2 celdas no vacías,
 * intentamos la siguiente como headers.
 */
export function readExcelBuffer(buffer: Buffer): ExcelParseResult {
  let workbook: XLSX.WorkBook
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  } catch {
    return { ok: false, headers: [], rows: [], error: 'El archivo Excel está corrupto o tiene un formato no compatible.' }
  }

  if (!workbook.SheetNames.length) {
    return { ok: false, headers: [], rows: [], error: 'El archivo Excel no contiene hojas de cálculo.' }
  }

  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1 }) as unknown[][]

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
      obj[h] = row[idx] ?? ''
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
