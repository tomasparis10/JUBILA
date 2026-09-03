export interface RenovProvisoria {
  nroResRenov: string
  nroExpMun: string
  fechaDesdeExp: string
  fechaHastaExp: string
  jNroExpCaja: string
  nroDcto: string
}

export interface TrazabilidadEntry {
  fecha: string
  beneficio: string
  observacion: string
}

export interface JubilacionRecord {
  id: string
  cuil: string
  dni: string
  apellidoNombres: string
  estadoActivo: boolean
  trazabilidad: TrazabilidadEntry[]
  telefono: string
  correo: string
  programa: string
  secretaria: string
  cargo: string
  antiguedadRecibo: string
  antiguedadLicencias: string
  fechaNacimiento: string
  edadActual: string
  fechaEstimadaJubilacionOrdinaria: string
  beneficio: string
  nroTramite: string
  fBaja: string
  nroExpMunRenuncia: string
  jNroExpCaja: string
  nroResRenCaja: string
  nroExpCajDeneg: string
  // Antecedentes / PAV (campos legacy)
  fInicExpMunPav: string
  nroExpedienteMun: string
  fInfPrevCaja: string
  fecha: string
  anios: string
  meses: string
  dias: string
  edadReq: string
  // Renovaciones provisorias
  renovaciones: RenovProvisoria[]
  // Notificaciones y Suspensiones
  notificacionArt43: string
  nExpArt43SuspPago: string
  // Pasividad
  fSolicitud: string
  fEstimadaJOrd: string
  nroExpPasividad: string
  fFirmaConvenio: string
  fInicioPasividad: string
  observacionPasividad: string
  // Observaciones
  observacion: string
}


export const BENEFICIO_OPTIONS = [
  { value: '1',  label: 'Jubilación Ordinaria' },
  { value: '2',  label: 'Jubilación por Invalidez Definitiva' },
  { value: '3',  label: 'Jubilación por Invalidez Provisoria' },
  { value: '4',  label: 'Jubilación por Edad Avanzada' },
  { value: '5',  label: 'Jubilación por Minusvalía' },
  { value: '6',  label: 'Reincorporación de Invalidez Provisoria' },
  { value: '7',  label: 'PAV' },
  { value: '8',  label: 'Jubilación en trámite' },
  { value: '9',  label: 'PAV en trámite' },
  { value: '10', label: 'PAV Desistido' },
  { value: '11', label: 'PAV caja no otorga' },
  { value: '12', label: 'Notificación por cédula' },
  { value: '13', label: 'Jubilación denegada' },
  { value: '14', label: 'Agendado con fecha estimada de Jubilación Ordinaria' },
  { value: '15', label: 'Extingue relación laboral' },
  { value: '16', label: 'Renuncia por razones particulares' },
  { value: '17', label: 'Fallecimiento' },
  { value: '18', label: 'Jubilación Anses' },
]

// Beneficio que muestra el bloque de Renovaciones Provisorias
export const BENEFICIO_INVALIDEZ_PROVISORIA = '3'

// Mapeo de beneficio → botones extra (además de los 2 fijos de PDF)
// Cada entrada es: { label, icon: 'printer'|'file-check'|'archive'|'file-text'|'check-square'|'send' }
export type BtnExtra = { label: string; icon: string }

export const BOTONES_POR_BENEFICIO: Record<string, BtnExtra[]> = {
  '1':  [ { label: 'Renuncia', icon: 'printer' }, { label: 'Pase Repartición', icon: 'send' } ],
  '2':  [ { label: 'Renuncia', icon: 'printer' }, { label: 'Pase Repartición', icon: 'send' } ],
  '3':  [ { label: 'Renuncia Provisoria', icon: 'printer' }, { label: 'Pase Interno', icon: 'send' } ],
  '4':  [ { label: 'Renuncia', icon: 'printer' }, { label: 'Pase Repartición', icon: 'send' } ],
  '5':  [ { label: 'Renuncia', icon: 'printer' }, { label: 'Pase Repartición', icon: 'send' } ],
  '6':  [],
  '7':  [],
  '8':  [],
  '9':  [
    { label: 'Impresión de Formulario de Solicitud', icon: 'file-text' },
    { label: 'Formulario de Aceptación y Rechazo', icon: 'check-square' },
    { label: 'Pase a Secretaría', icon: 'send' },
  ],
  '10': [ { label: 'Pase al Archivo', icon: 'archive' } ],
  '11': [ { label: 'Pase al Archivo', icon: 'archive' } ],
  '12': [],
  '13': [],
  '14': [],
  '15': [ { label: 'Pase Interno', icon: 'send' } ],
  '16': [ { label: 'Renuncia', icon: 'printer' }, { label: 'Pase Repartición', icon: 'send' } ],
  '17': [],
  '18': [ { label: 'Renuncia', icon: 'printer' }, { label: 'Pase Repartición', icon: 'send' } ],
}

// Beneficios "activos" (agente activo = verde en header)
export const BENEFICIOS_ACTIVOS = new Set(['1', '2', '3', '4', '5', '6', '7', '8', '9', '15', '16', '18'])
