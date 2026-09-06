/**
 * Formats digits into expediente format: 000.000/00
 * Only accepts numbers and formats as XXX.XXX/XX
 */
export function formatExpediente(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}/${digits.slice(6, 8)}`
}

/**
 * Formats digits into date format: 00/00/0000 (dd/mm/aaaa)
 * Only accepts numbers and formats as DD/MM/YYYY
 */
export function formatDate(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Valida si un string con fecha dd/mm/aaaa es válido.
 * Retorna true si está vacío (campos opcionales).
 */
export function isValidDateString(val: string): boolean {
  if (!val || !val.trim()) return true
  const parts = val.trim().split('/')
  if (parts.length !== 3) return false
  const [dStr, mStr, yStr] = parts
  if (dStr.length !== 2 || mStr.length !== 2 || yStr.length !== 4) return false
  const d = parseInt(dStr, 10)
  const m = parseInt(mStr, 10)
  const y = parseInt(yStr, 10)
  if (isNaN(d) || isNaN(m) || isNaN(y)) return false
  if (y < 1900 || y > 2100) return false
  if (m < 1 || m > 12) return false
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  if (d < 1 || d > daysInMonth) return false
  return true
}

/**
 * Devuelve un mensaje de error si la fecha es inválida o incompleta, o null si es válida.
 * Solo valida si el campo contiene texto (los campos vacíos se consideran válidos).
 */
export function getDateValidationError(val: string | null | undefined, touched = false): string | null {
  if (!val || !val.trim()) return null
  const v = val.trim()
  const parts = v.split('/')

  if (parts[0] && parts[0].length === 2) {
    const d = parseInt(parts[0], 10)
    if (isNaN(d) || d < 1 || d > 31) return 'Día inválido (01 al 31)'
  }

  if (parts[1] && parts[1].length === 2) {
    const m = parseInt(parts[1], 10)
    if (isNaN(m) || m < 1 || m > 12) return 'Mes inválido (01 al 12)'
  }

  if (v.length >= 10) {
    const d = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const y = parseInt(parts[2], 10)
    if (isNaN(y) || y < 1900 || y > 2100) return 'Año inválido (1900-2100)'
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
    if (d < 1 || d > daysInMonth) return `Día inexistente (${d}/${m}/${y})`
    if (!isValidDateString(v)) return 'Fecha inválida (dd/mm/aaaa)'
  } else if (touched && v.length > 0) {
    return 'Fecha incompleta (dd/mm/aaaa)'
  }

  return null
}

/**
 * Retorna true si la fecha es válida o si está vacía.
 */
export function isDateValidOrEmpty(val: string | null | undefined): boolean {
  if (!val || !val.trim()) return true
  return getDateValidationError(val, true) === null
}


/**
 * Formats digits into CUIL format: 00-00000000-0
 * Only accepts numbers and formats as XX-XXXXXXXX-X (11 digits max)
 */
export function formatCuil(value: string): string {
  if (!value) return ''
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10, 11)}`
}

/**
 * Extracts DNI from a CUIL string.
 * Middle digits of CUIL (after the 2-digit prefix, up to 8 digits).
 */
export function extractDniFromCuil(cuilValue: string): string {
  if (!cuilValue) return ''
  const digits = cuilValue.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return ''
  if (digits.length <= 10) return digits.slice(2)
  return digits.slice(2, 10)
}

/**
 * Filters input to only allow letters and spaces (including accents and ñ).
 */
export function formatLettersOnly(value: string): string {
  if (!value) return ''
  return value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]/g, '')
}

/**
 * Filters input to only allow numeric digits.
 */
export function formatDigitsOnly(value: string): string {
  if (!value) return ''
  return value.replace(/\D/g, '')
}

