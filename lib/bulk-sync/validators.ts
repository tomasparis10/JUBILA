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

/** Tabla del rango C1 (0x80-0x9F) de Windows-1252. */
const CP1252_HIGH = [
  0x20ac, 0x0081, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021,
  0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0x008d, 0x017d, 0x008f,
  0x0090, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014,
  0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x009d, 0x017e, 0x0178,
]

/**
 * Detecta si el "Excel" es en realidad una tabla HTML.
 *
 * Los exportes del sistema Raet llegan con extensión .xls pero son HTML
 * (doctype + <table>). SheetJS los acepta, así que el problema no es que los
 * rechace: es que los decodifica como UTF-8 y rompe las tildes y la Ñ.
 */
export function looksLikeHtml(buffer: Buffer): boolean {
  const head = buffer.subarray(0, 2048).toString('latin1')
  return /<html|<table|<!doctype\s+html/i.test(head)
}

/**
 * Decodifica un buffer Windows-1252 a string.
 *
 * Los exports de Raet declaran `charset=iso-8859-1` pero escriben los bytes de
 * Windows-1252 (0xD1 = Ñ, 0xB0 = °, 0x92 = ’). Al decodificar como UTF-8, el
 * 0xD1 se toma como byte inicial de una secuencia de 2 bytes y se come la
 * letra siguiente: "MONSEÑOR" Terminaba como "MONSEяR" (la Ñ como cirílico y la
 * O desaparecida). Decodificar con cp1252 devuelve el texto exacto.
 */
export function decodeCp1252(buffer: Buffer): string {
  let out = ''
  const CHUNK = 0x8000
  for (let i = 0; i < buffer.length; i += CHUNK) {
    const slice = buffer.subarray(i, i + CHUNK)
    let s = ''
    for (let j = 0; j < slice.length; j++) {
      const b = slice[j]
      s += b >= 0x80 && b <= 0x9f ? String.fromCharCode(CP1252_HIGH[b - 0x80]) : String.fromCharCode(b)
    }
    out += s
  }
  return out
}

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
    // Los exports de Raet son HTML con extensión .xls y bytes cp1252: hay que
    // decodificarlos a mano para no perder tildes ni Ñ (ver decodeCp1252).
    const esHtml = looksLikeHtml(buffer)
    workbook = XLSX.read(esHtml ? decodeCp1252(buffer) : buffer, {
      type: esHtml ? 'string' : 'buffer',
      // En los exportes HTML SheetJS adivina el tipo de cada celda y convierte
      // las fechas a serial de Excel. Eso rompe las fechas ambiguas: el texto
      // "01/02/1900" se resolvía como 02/01 y quedaba el serial 3, que luego
      // volvía como 03/01/1900 (3.640 agentes con fecha 1900 cambiaban de
      // fecha en cada carga). Con raw el texto queda tal cual está en el
      // archivo y lo interpreta normalizeDate como dd/mm/aaaa.
      // De paso conserva los ceros a la izquierda del DNI ("05455449"), que
      // al parsearlo como número perdían el 0 inicial.
      raw: esHtml ? true : undefined,
      cellDates: false,
      cellNF: true,
    })
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

/**
 * Reduce un nombre de columna a una clave comparable: sin acentos, sin
 * mayúsculas/minúsculas y sin espacios, signos ni símbolos.
 * "Segundo N° Apellido Agente" y "SEGUNDO_APELLIDO_AGENTE" dan la misma clave.
 */
export function claveColumna(header: string): string {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
}

/**
 * Alias aceptados para los campos de nombre. Los Excel exportados por distintos
 * orígenes usan variantes ("SEGUNDO_NOMBRE", "2° NOMBRE", "SEGUNDO NOMBRE
 * AGENTE"), y antes esas columnas se ignoraban en silencio: los cambios de
 * segundo nombre/apellido no llegaban a verse en el análisis.
 */
export const ALIAS_NOMBRE = ['NOMBRE', 'NOMBRE AGENTE', 'NOMBRES']
export const ALIAS_APELLIDO = ['APELLIDO', 'APELLIDOS', 'APELLIDO AGENTE']
export const ALIAS_SEGUNDO_NOMBRE = [
  'SEGUNDO_NOMBRE',
  'SEGUNDO NOMBRE AGENTE',
  'SEGUNDO NOMBRE 1',
  'SEGUNDO N° NOMBRE',
  '2° NOMBRE',
  '2 NOMBRE',
  'NOMBRE 2',
  'NOMBRE SECUNDARIO',
]
export const ALIAS_SEGUNDO_APELLIDO = [
  'SEGUNDO_APELLIDO',
  'SEGUNDO APELLIDO AGENTE',
  'SEGUNDO APELLIDO 1',
  'SEGUNDO N° APELLIDO',
  '2° APELLIDO',
  '2 APELLIDO',
  'APELLIDO 2',
  'APELLIDO SECUNDARIO',
]

/**
 * Igual que getCol pero tolerante a variantes del encabezado:
 * 1) coincidencia exacta
 * 2) case-insensitive
 * 3) clave normalizada (ignora acentos, espacios, "_", "°", etc.)
 *
 * Entre las variantes se elige la primera con valor. Si el archivo tiene la
 * columna "SEGUNDO_NOMBRE_AGENTE" vacía pero trae el dato en "SEGUNDO NOMBRE",
 * se usa la que tiene contenido: antes el dato se perdía en silencio.
 * Si ninguna existe devuelve ''.
 */
export function getColFlexible(
  row: Record<string, unknown>,
  colName: string,
  alias: string[] = [],
): unknown {
  const candidatas = [colName, ...alias]
  const claves = Object.keys(row)
  const vistos = new Set<string>()
  const valores: unknown[] = []

  const recolectar = (compararNormalizado: boolean) => {
    for (const col of candidatas) {
      const objetivo = compararNormalizado ? claveColumna(col) : col.toUpperCase()
      if (!objetivo) continue
      for (const key of claves) {
        if (vistos.has(key)) continue
        const coincide = compararNormalizado
          ? claveColumna(key) === objetivo
          : key.toUpperCase() === objetivo
        if (!coincide) continue
        vistos.add(key)
        valores.push(row[key])
      }
    }
  }

  recolectar(false)
  recolectar(true)

  for (const valor of valores) {
    if (valor !== '' && valor !== null && valor !== undefined) return valor
  }
  return valores.length ? valores[0] : ''
}
