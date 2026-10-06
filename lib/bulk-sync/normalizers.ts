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

/**
 * Repara los caracteres que aparecen en los exportes de Raet con la tabla de
 * caracteres corrida. Son bytes de latin1 que en el archivo original
 * representarían eñes y tildes, y que sin esta reparación se perdían al
 * limpiar (la eñe desaparecía del todo):
 *   0xA6 ¦ → Ñ    MA¦EZ    → MAÑEZ
 *   0xD0 Ð → Ñ    NIÐEZ    → NIÑEZ
 *   0xB4 ´ → '    D´ANGELO → D'ANGELO
 *   0xCC Ì → Í    ITATÌ    → ITATÍ
 *
 * Los valores no recuperables (U+FFFD) se eliminan para que nunca vuelvan a
 * guardarse como rombos en la DB.
 */
export function cleanImportedText(value: unknown): string {
  return toStr(value)
    .replace(/¦/g, 'Ñ')
    .replace(/Ð/g, 'Ñ')
    .replace(/´/g, "'")
    .replace(/Ì/g, 'Í')
    .replace(/�/g, '')
    // Se conservan guion, apóstrofe, punto, coma, grado, # y paréntesis: son
    // parte de nombres reales (MARIA-JOSE, GOMEZ-ORTIZ, DEL C., O'BRIEN, N°)
    // y antes se perdían al limpiar.
    .replace(/[^\x00-\x7FÁÉÍÓÚÜÑáéíóúüñ°'’.,()#/-]/g, '')
}

// ─────────────────────────────────────────────────────────────────────────────
// Reparación de "?" que representan caracteres acentuados (ñ, tildes, N°)
// ─────────────────────────────────────────────────────────────────────────────

/** Candidatos a reemplazar: acentos españoles, diéresis y eñe. */
const REPAIR_CANDIDATES = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ']

/** Convierte un carácter acentuado a su versión en mayúscula. */
const ACCENT_UPPER: Record<string, string> = { á: 'Á', é: 'É', í: 'Í', ó: 'Ó', ú: 'Ú', ü: 'Ü', ñ: 'Ñ' }

/**
 * Construye un diccionario de palabras correctas a partir de textos sin "?".
 * Clave: token sin acentos (normalizado). Valor: forma más frecuente,
 * prefiriendo la que conserve acentos en caso de empate.
 */
export function buildSpanishTokenDictionary(
  entries: Iterable<string | null | undefined>,
): Map<string, string> {
  const count = new Map<string, Map<string, number>>()
  for (const raw of entries) {
    if (!raw) continue
    for (const tokenRaw of raw.split(/(\s+)/)) {
      const token = tokenRaw.trim()
      if (!token || token.includes('?')) continue
      const key = removeAccents(token).toLowerCase()
      let forms = count.get(key)
      if (!forms) {
        forms = new Map()
        count.set(key, forms)
      }
      forms.set(token, (forms.get(token) ?? 0) + 1)
    }
  }
  const dict = new Map<string, string>()
  for (const [key, forms] of count) {
    let best = ''
    let bestN = -1
    for (const [form, n] of forms) {
      if (n > bestN || (n === bestN && removeAccents(form) !== form && !(removeAccents(best) !== best))) {
        best = form
        bestN = n
      }
    }
    dict.set(key, best)
  }
  return dict
}

/**
 * Repara los "?" que en los XLS corruptos representan una letra acentuada
 * (ñ, á-é-í-ó-ú-ü) o el símbolo ordinal de "N°".
 *
 * Estrategia: para cada token con "?", se prueban los caracteres candidatos y
 * se acepta el primero que forme una palabra conocida (según el diccionario
 * de la propia base, sin acentos). Si ninguno coincide, se asume "ñ" (caso
 * más frecuente). El ordinal "N?<dígitos>" se resuelve como "N°<dígitos>".
 */
export function repairQuestionMarks(value: string, dict?: Map<string, string>): string {
  if (!value || !value.includes('?')) return value

  const segs = value.split(/(\s+)/)
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (!seg.includes('?')) continue

    // Ordinal N?<dígitos> -> N°<dígitos>
    const ordinal = seg.match(/^([Nn])\?(\d+)$/)
    if (ordinal) {
      segs[i] = ordinal[1] === 'n' ? `n°${ordinal[2]}` : `N°${ordinal[2]}`
      continue
    }

    const upperContext = /[A-Z]/.test(seg)
    let resolved: string | null = null
    if (dict) {
      for (const cand of REPAIR_CANDIDATES) {
        const key = removeAccents(seg.replace(/\?/g, cand)).toLowerCase()
        if (dict.has(key)) {
          // Usar la forma canónica conocida de la base (conserva la tilde/ñ
          // correcta y su casuística), en vez de confiar en la heurística.
          resolved = dict.get(key)!
          break
        }
      }
    }
    if (resolved === null) {
      resolved = seg.replace(/\?/g, 'ñ')
    }
    if (upperContext) {
      resolved = resolved.replace(/[áéíóúüñ]/g, (ch) => ACCENT_UPPER[ch])
    }
    segs[i] = resolved
  }
  return segs.join('')
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

  const s = removeAccents(cleanImportedText(value)).toUpperCase()

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
  let s = removeAccents(cleanImportedText(value)).toUpperCase().replace(/\s+/g, ' ')

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
 * Convierte cualquier representación de fecha a Date UTC o null.
 *
 * ESTRATEGIA (decisión del usuario — dd/mm/aaaa):
 *
 * readExcelBuffer lee las celdas como su TEXTO MOSTRADO (raw:false). Esta
 * función lo interpreta SIEMPRE como DD/MM/AAAA (día/mes, convención argentina):
 * "10/4/69" → 10/04/1969, "15/02/1954" → 15/02/1954. Así la fecha guardada es
 * EXACTAMENTE la que el usuario ve en la celda del Excel.
 *
 * El serial numérico solo se usa como RESPALDO (celdas de fecha cuyo texto no
 * resultó legible o números puros), convertido sin zona horaria.
 *
 * SIEMPRE se construye con Date.UTC() → la DB guarda yyyy-mm-dd (medianoche
 * UTC) y, al leer con getUTC*, el día NO se desplaza por zona horaria.
 */
export function normalizeDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null

  // ── Caso 1: Objeto Date (rutas que usen cellDates:true) ──────────────────
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return null
    const y = value.getUTCFullYear()
    const m = value.getUTCMonth()
    const d = value.getUTCDate()
    if (y < 1900 || y > 2100) return null
    return new Date(Date.UTC(y, m, d))
  }

  // ── Caso 2: Número serial de Excel (respaldo) ─────────────────────────────
  if (typeof value === 'number') {
    if (value <= 0) return null
    const d = excelSerialToUTC(value)
    const y = d.getUTCFullYear()
    if (y < 1900 || y > 2100) return null
    return new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()))
  }

  // ── Caso 3: String (celdas escritas a mano o serial en texto) ─────────────
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null

    // Serial que llegó como string (respaldo)
    if (/^\d{4,5}$/.test(s)) {
      const num = Number(s)
      if (num > 0) {
        const d = excelSerialToUTC(num)
        const y = d.getUTCFullYear()
        if (y >= 1900 && y <= 2100) return new Date(Date.UTC(y, d.getUTCMonth(), d.getUTCDate()))
      }
    }

    // yyyy-mm-dd o yyyy/mm/dd (formato ISO)
    const ymd = s.match(/^(\d{4})[-\/\.](\d{1,2})[-\/\.](\d{1,2})/)
    if (ymd) {
      return buildStrictUTCDate(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]))
    }

    // dd/mm/yyyy o d/m/yyyy (año 4 dígitos — priorytario DD/MM/AAAA argentino)
    const dmy4 = s.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{4})$/)
    if (dmy4) {
      let d = Number(dmy4[1])
      let m = Number(dmy4[2])
      const y = Number(dmy4[3])
      // Fallback si m > 12 pero d <= 12 (texto accidental tipo m/d/yyyy)
      if (m > 12 && d <= 12) {
        const temp = d
        d = m
        m = temp
      }
      return buildStrictUTCDate(y, m, d)
    }

    // dd/mm/yy o d/m/yy (año 2 dígitos, pivote 30: 30-99 → 1930-1999 | 00-29 → 2000-2029)
    const dmy2 = s.match(/^(\d{1,2})[-\/\.](\d{1,2})[-\/\.](\d{2})$/)
    if (dmy2) {
      let d = Number(dmy2[1])
      let m = Number(dmy2[2])
      const yy = Number(dmy2[3])
      const year = yy >= 30 ? 1900 + yy : 2000 + yy
      if (m > 12 && d <= 12) {
        const temp = d
        d = m
        m = temp
      }
      return buildStrictUTCDate(year, m, d)
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
 *
 * Se usa round para conservar el día calendario que Excel muestra cuando el
 * serial llega con una hora interna cercana a medianoche (ej. ...999).
 */
function excelSerialToUTC(serial: number): Date {
  const MS_POR_DIA = 86_400_000
  const epoch = Date.UTC(1899, 11, 31)
  const wholeSerial = Math.round(serial)
  const correctedSerial = wholeSerial > 59 ? wholeSerial - 1 : wholeSerial
  return new Date(epoch + correctedSerial * MS_POR_DIA)
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
 * Marcador interno para conservar la Ñ a través de la eliminación de acentos y
 * del filtro ASCII. Es un carácter de área privada: no aparece en ningún archivo
 * de datos ni se puede escribir a mano, así que no puede chocar con el texto real.
 */
const MARCA_ENIE = '\uE000'

/**
 * Normaliza un string para comparación semántica.
 *
 * Se conserva la Ñ: es una letra del alfabeto español, no un acento de la N.
 * Con la versión anterior removeAccents() convertía Ñ en N, así que un agente
 * que en la base quedó sin Ñ (imports previos que leían los exportes de Raet
 * como UTF-8 y se comían el byte) se comparaba igual que el Excel y quedaba
 * para siempre en "sin cambios", sin forma de corregirse nunca. El payload
 * sigue conservando el texto limpio: este valor es solo la clave de comparación.
 */
export function normStr(v: unknown): string {
  // NFC antes de limpiar: cleanImportedText recorta los acentos combinados
  // (U+0300–U+036F), así que "españa" descompuesta (n + U+0303) perdería la Ñ
  // antes de poder componerla y se compararía distinto que "ESPAÑA".
  const conEnie = cleanImportedText(String(v ?? '').normalize('NFC'))
    .toUpperCase()
    .replace(/Ñ/g, MARCA_ENIE)
  return removeAccents(conEnie)
    .replace(/[^\x00-\x7F\uE000]/g, '')
    .replace(/[^A-Z0-9\uE000]/g, '')
    .replace(/\uE000/g, 'Ñ')
}

/**
 * Compara dos valores como "vacío" de manera semántica.
 * null, undefined, '' y '  ' son equivalentes.
 */
export function eqEmpty(a: unknown, b: unknown): boolean {
  return !toStr(a) && !toStr(b)
}

// ─────────────────────────────────────────────────────────────────────────────
// Nombres compuestos: segundo nombre / segundo apellido
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Quita de `principal` el sufijo que ya está contenido en `sufijo`.
 *
 * Caso real: el Excel exportado trae el nombre completo en la columna
 * NOMBRE_AGENTE ("MONICA DEL VALLE") y además el segundo nombre en su propia
 * columna ("DEL VALLE"). Sin separar el sufijo, el nombre quedaría duplicado
 * ("MONICA DEL VALLE DEL VALLE") y el guardado sería incorrecto.
 *
 * Reglas:
 * - Solo separa si `principal` termina con `sufijo` (comparación semántica:
 *   ignora acentos, mayúsculas y signos).
 * - No separa si `principal` es igual a `sufijo`: en ese caso el valor se
 *   conserva íntegro en el primer campo.
 */
export function separarSufijo(principal: string, sufijo: string): string {
  const p = String(principal ?? '').trim()
  const s = String(sufijo ?? '').trim()
  if (!p || !s) return p

  const kp = normStr(p)
  const ks = normStr(s)
  if (!ks || !kp.endsWith(ks)) return p

  const partes = p.split(/\s+/)
  const partesSufijo = s.split(/\s+/)
  // No dejar el primero sin contenido: "DEL VALLE" no se parte en "".
  if (partes.length <= partesSufijo.length) return p

  return partes.slice(0, partes.length - partesSufijo.length).join(' ')
}

/**
 * Reconcilia el par (primer campo, segundo campo) de un Excel:
 * - Si el segundo campo está vacío → se conserva el valor actual de la DB.
 * - Si el primer campo ya contiene al segundo → se separa (el Excel trajo el
 *   nombre completo en la columna del primer campo).
 * - Si ambos traen exactamente el mismo texto → queda solo en el primero.
 *
 * @returns [valorPrimero, valorSegundo]
 */
export function reconciliarPar(
  valorPrimero: string,
  valorSegundo: string,
  actualPrimero: string | null | undefined,
  actualSegundo: string | null | undefined,
): [string, string] {
  let primero = String(valorPrimero ?? '').trim()
  let segundo = String(valorSegundo ?? '').trim()

  if (!primero && actualPrimero) primero = String(actualPrimero).trim()
  if (!segundo && actualSegundo) segundo = String(actualSegundo).trim()

  // Ambos idénticos → el segundo es redundante.
  if (primero && segundo && normStr(primero) === normStr(segundo)) segundo = ''

  // El primero ya trae al segundo dentro (Excel con nombre completo).
  if (primero && segundo) primero = separarSufijo(primero, segundo)

  // Caso inverso: el segundo trae al primero (a veces pasa con partículas).
  if (primero && segundo) segundo = separarSufijo(segundo, primero)

  return [primero, segundo]
}

/**
 * Compone el nombre completo para mostrar en la UI:
 * APELLIDO [2º APELLIDO] NOMBRE [2º NOMBRE], sin duplicar segmentos y sin
 * inventar separadores dobles.
 */
export function componerNombreCompleto(datos: {
  apellido?: string | null
  segundoApellido?: string | null
  nombre?: string | null
  segundoNombre?: string | null
}): string {
  const partes: string[] = []
  for (const bruto of [datos.apellido, datos.segundoApellido, datos.nombre, datos.segundoNombre]) {
    const valor = String(bruto ?? '').trim()
    if (!valor) continue
    // Evitar el mismo texto dos veces seguidas (p.ej. 2º apellido = apellido).
    const clave = normStr(valor)
    if (partes.length && normStr(partes[partes.length - 1]) === clave) continue
    partes.push(valor)
  }
  return partes.join(' ')
}
