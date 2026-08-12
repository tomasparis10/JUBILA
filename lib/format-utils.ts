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
