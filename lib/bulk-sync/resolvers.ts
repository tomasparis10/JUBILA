/**
 * lib/bulk-sync/resolvers.ts
 *
 * Resuelve el ID_REGIMEN_JUBILATORIO a partir del nombre del régimen y el sexo.
 *
 * ESTRATEGIA: normalizar nombre y sexo, luego buscar en la tabla diccionario.
 * NO hardcodear IDs. La fuente de verdad es REGIMEN_JUBILATORIO en la DB.
 *
 * REGLA ABSOLUTA: si no puede determinarse con seguridad → devolver null.
 * El caller debe tratar null como error crítico y no insertar/actualizar.
 */

import { normalizeRegimen, normalizeSexo } from './normalizers'
import type { RegimenRow } from './types'

/**
 * Resuelve el ID del régimen jubilatorio.
 *
 * @param nombreRegimen - Valor crudo del campo NOMBRE_REGIMEN del Excel
 * @param sexoRaw - Valor crudo del campo SEXO del Excel
 * @param regimenes - Todos los regímenes cargados de la DB
 * @returns El ID correspondiente, o null si no puede determinarse
 *
 * El proceso:
 * 1. Normalizar nombreRegimen → nombre canónico
 * 2. Normalizar sexo → 'Masculino' | 'Femenino'
 * 3. Buscar en tabla diccionario por nombre canónico + sexo normalizado
 * 4. Si no hay coincidencia → null (NO asignar por defecto)
 */
export function resolveRegimenId(
  nombreRegimen: unknown,
  sexoRaw: unknown,
  regimenes: RegimenRow[],
): { id: number; regimenCanónico: string; sexoNormalizado: string } | null {
  const regimenNormalizado = normalizeRegimen(nombreRegimen)
  const sexoNormalizado = normalizeSexo(sexoRaw)

  // Si no se pudo normalizar alguno → no determinar ID
  if (!regimenNormalizado || !sexoNormalizado) return null

  // Buscar en tabla diccionario (comparación insensible a mayúsculas para robustez)
  const match = regimenes.find((r) => {
    const dbNombre = r.NOMBRE_REGIMEN.trim().toUpperCase()
    const dbSexo = (r.SEXO ?? '').trim()
    return dbNombre === regimenNormalizado.toUpperCase() && dbSexo === sexoNormalizado
  })

  if (!match) return null

  return {
    id: match.ID_REGIMEN_JUBILATORIO,
    regimenCanónico: regimenNormalizado,
    sexoNormalizado,
  }
}

/**
 * Calcula la FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA sumando EDAD_REQUERIDA
 * años a la fecha de nacimiento. Maneja el borde 29/02.
 */
export function calcFechaEstimada(fechaNac: Date, edadRequerida: number): Date {
  const year = fechaNac.getUTCFullYear() + edadRequerida
  const month = fechaNac.getUTCMonth()
  const day = fechaNac.getUTCDate()
  // Ajuste borde: 29/02 en año no bisiesto → 28/02
  const maxDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(day, maxDay)))
}

/**
 * Calcula la edad actual en años completos a partir de una fecha de nacimiento UTC.
 */
export function calcEdadActual(fechaNac: Date): number {
  const hoy = new Date()
  const hoyY = hoy.getUTCFullYear()
  const hoyM = hoy.getUTCMonth()
  const hoyD = hoy.getUTCDate()
  const nacY = fechaNac.getUTCFullYear()
  const nacM = fechaNac.getUTCMonth()
  const nacD = fechaNac.getUTCDate()
  let edad = hoyY - nacY
  if (hoyM < nacM || (hoyM === nacM && hoyD < nacD)) edad--
  return edad
}
