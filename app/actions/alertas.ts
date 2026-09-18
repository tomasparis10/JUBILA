'use server'

import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { requireAuthenticatedSession } from '@/lib/auth-session'
import { logServerError } from '@/lib/safe-error'

export interface AlertaInvalidezProvisoria {
  dni: string
  nombreCompleto: string
  cargo: string | null
  programa: string | null
  fechaDesde: string | null
  fechaHasta: string
  diasRestantes: number
}

/** Fecha Date-only de SQL Server → 'dd/mm/aaaa' (partes UTC, sin corrimiento de zona). */
function dbDateToStr(date: Date | null | undefined): string | null {
  if (!date) return null
  const d = new Date(date)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getUTCFullYear()}`
}

interface FilaAlerta {
  DNI_AGENTE: string
  NOMBRE_COMPLETO: string
  CARGO: string | null
  PROGRAMA: string | null
  FECHA_DESDE_PROVISORIA: Date | null
  FECHA_HASTA_PROVISORIA: Date
}

/**
 * Alertas activas de invalidez provisoria:
 * personas que existen (con expediente JUBILA, sin importar si están
 * "activas") cuya causa de baja en el expediente (CAUSA_BAJA) es de
 * "JUBILACION POR INVALIDEZ PROVISORIA" y cuyo ÚLTIMO bloque de
 * Otorgamiento y Renovación Provisoria tiene FECHA_HASTA dentro de
 * los próximos 90 días (hoy → hoy+90, sin incluir vencidas pasadas).
 */
export async function getAlertasInvalidezProvisoria(): Promise<AlertaInvalidezProvisoria[]> {
  try {
    await requireAuthenticatedSession()

    const ahora = new Date()
    const hoyUtc = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
    const hasta90Utc = new Date(hoyUtc.getTime() + 90 * 86400000)

    const filas = await prisma.$queryRaw<FilaAlerta[]>(
      Prisma.sql`
      SELECT
        d.DNI_AGENTE AS DNI_AGENTE,
        (d.APELLIDO_AGENTE + ', ' + d.NOMBRE_AGENTE) AS NOMBRE_COMPLETO,
        d.CARGO AS CARGO,
        d.PROGRAMA AS PROGRAMA,
        o.FECHA_DESDE_PROVISORIA AS FECHA_DESDE_PROVISORIA,
        o.FECHA_HASTA_PROVISORIA AS FECHA_HASTA_PROVISORIA
      FROM OTORGAMIENTO_RENOVACION_PROVISORIAS o
      JOIN JUBILA j ON j.ID_JUBILA = o.ID_JUBILA
      JOIN DATOS_PERSONALES_AGENTE_JUBILA d ON d.ID_DATOS_PERSONALES_AGENTE_JUBILA = j.ID_AGENTE
      WHERE o.FECHA_HASTA_PROVISORIA IS NOT NULL
        AND o.FECHA_HASTA_PROVISORIA >= ${hoyUtc}
        AND o.FECHA_HASTA_PROVISORIA <= ${hasta90Utc}
        -- Solo el ÚLTIMO bloque del agente (puede haber varias renovaciones)
        AND o.FECHA_HASTA_PROVISORIA = (
          SELECT MAX(o2.FECHA_HASTA_PROVISORIA)
          FROM OTORGAMIENTO_RENOVACION_PROVISORIAS o2
          JOIN JUBILA j2 ON j2.ID_JUBILA = o2.ID_JUBILA
          WHERE j2.ID_AGENTE = j.ID_AGENTE AND o2.FECHA_HASTA_PROVISORIA IS NOT NULL
        )
        -- Solo expedientes no borrados
        AND j.BIT_BORRADO = 0
        -- Causa de baja del expediente JUBILA: SOLO "JUBILACION POR INVALIDEZ PROVISORIA" (ID 3)
        AND EXISTS (
          SELECT 1 FROM HISTORIAL_CAUSA_BAJA h
          WHERE h.ID_JUBILA = j.ID_JUBILA
            AND h.FECHA_FIN_CAUSA_BAJA IS NULL
            AND h.ID_CAUSA_BAJA = 3
        )
      ORDER BY o.FECHA_HASTA_PROVISORIA ASC
      `,
    )

    return filas.map((f) => ({
      dni: f.DNI_AGENTE,
      nombreCompleto: f.NOMBRE_COMPLETO || '—',
      cargo: f.CARGO ?? null,
      programa: f.PROGRAMA ?? null,
      fechaDesde: dbDateToStr(f.FECHA_DESDE_PROVISORIA),
      fechaHasta: dbDateToStr(f.FECHA_HASTA_PROVISORIA) ?? '',
      diasRestantes: Math.max(0, Math.ceil((new Date(f.FECHA_HASTA_PROVISORIA).getTime() - hoyUtc.getTime()) / 86400000)),
    }))
  } catch (error) {
    logServerError('[getAlertasInvalidezProvisoria] Error:', error)
    return []
  }
}

/** Cantidad de alertas activas (para el contador del menú lateral). */
export async function getCantidadAlertasActivas(): Promise<number> {
  const alertas = await getAlertasInvalidezProvisoria()
  return alertas.length
}