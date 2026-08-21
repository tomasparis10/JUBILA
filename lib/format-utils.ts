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
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
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

