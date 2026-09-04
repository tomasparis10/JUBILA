/**
 * lib/bulk-sync/types.ts
 *
 * Tipos compartidos para el módulo de Actualización Masiva desde Excel.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de análisis
// ─────────────────────────────────────────────────────────────────────────────

export interface DiffField {
  campo: string
  anterior: string
  nuevo: string
}

// Datos Personales
export interface DpRowNueva {
  kind: 'insert'
  dni: string | null
  nombre: string
  apellido: string
  secretaria: string
  programa: string
  cargo: string
  sexo: string
  estadoActivo: boolean
  cuil: string
  telefono: string
  correo: string
  fechaNacimiento: string
  idRegimen: number | null
  // Fecha serializada como ISO para transferir sin problemas de timezone
  fechaNacimientoISO: string
}

export interface DpRowActualizada {
  kind: 'update'
  dni: string
  nombre: string
  apellido: string
  diffs: DiffField[]
  // Datos normalizados para el commit
  payload: DpUpdatePayload
}

export interface DpUpdatePayload {
  NOMBRE_AGENTE: string
  APELLIDO_AGENTE: string
  FECHA_NACIMIENTO: string // ISO date string
  SECRETARIA: string | null
  PROGRAMA: string | null
  CARGO: string | null
  SEXO: string | null
  ESTADO_ACTIVO: boolean
  CUIL: string | null
  NUMERO_TELEFONO: string | null
  CORREO_ELECTRONICO: string | null
  ID_REGIMEN_JUBILATORIO: number | null
}

export interface DpRowError {
  kind: 'error'
  rowIndex: number
  archivo: string
  campo: string
  valor: string
  descripcion: string
}

// Carrera Administrativa
export interface CaRowNueva {
  kind: 'insert'
  dni: string
  fechaAltaISO: string
  fechaBajaISO: string | null
  causaBaja: string | null
  fechaAltaStr: string
  fechaBajaStr: string
}

export interface CaRowActualizada {
  kind: 'update'
  idCarrera: number
  dni: string
  fechaAltaStr: string
  diffs: DiffField[]
  payload: {
    FECHA_BAJA: string | null // ISO
    CAUSA_BAJA: string | null
  }
}

export interface CaRowError {
  kind: 'error'
  rowIndex: number
  archivo: string
  campo: string
  valor: string
  descripcion: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Resultado del análisis completo
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  datosPersonales: {
    nuevas: DpRowNueva[]
    actualizadas: DpRowActualizada[]
    sinCambios: number
    errores: DpRowError[]
    omitidas: number
    sinDni: DpRowError[]
  }
  carreraAdministrativa: {
    nuevas: CaRowNueva[]
    actualizadas: CaRowActualizada[]
    sinCambios: number
    errores: CaRowError[]
    ignoradas: number
    noEncontradas: CaRowError[]
  }
  /** true si hay errores críticos que impiden el commit */
  tieneErroresCriticos: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// Tipos de Prisma simplificados (lo que necesitamos del schema)
// ─────────────────────────────────────────────────────────────────────────────

export interface RegimenRow {
  ID_REGIMEN_JUBILATORIO: number
  NOMBRE_REGIMEN: string
  SEXO: string | null
  EDAD_REQUERIDA: number
}

export interface AgenteExistente {
  DNI_AGENTE: string | null
  ID_REGIMEN_JUBILATORIO: number | null
  NOMBRE_AGENTE: string
  APELLIDO_AGENTE: string
  FECHA_NACIMIENTO: Date
  SECRETARIA: string | null
  PROGRAMA: string | null
  CARGO: string | null
  SEXO: string | null
  ESTADO_ACTIVO: boolean
  CUIL: string | null
  NUMERO_TELEFONO: string | null
  CORREO_ELECTRONICO: string | null
}

export interface FaseExistente {
  ID_CARRERA: number
  DOCUMENTO_EMPLEADO: string
  FECHA_ALTA: Date | null
  FECHA_BAJA: Date | null
  CAUSA_BAJA: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Respuestas API
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyzeApiResponse {
  ok: boolean
  analysis?: AnalysisResult
  error?: string
  /** Errores de validación de archivos (antes de procesar filas) */
  validationErrors?: string[]
}

export interface CommitApiResponse {
  ok: boolean
  lastUpdated?: string
  datosPersonales?: {
    insertados: number
    actualizados: number
    sinCambios: number
    errores: number
  }
  carreraAdministrativa?: {
    insertadas: number
    actualizadas: number
    sinCambios: number
    errores: number
  }
  error?: string
}
