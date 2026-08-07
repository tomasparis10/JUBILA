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

export const MOCK_RECORDS: JubilacionRecord[] = [
  {
    id: '1',
    cuil: '20-00509894-4',
    dni: '509894',
    apellidoNombres: 'ABACA EDUARDO LUIS',
    estadoActivo: true,
    trazabilidad: [
      { fecha: '15/03/2010', beneficio: 'PAV en trámite', observacion: 'Inicio de trámite PAV.' },
      { fecha: '23/02/2011', beneficio: 'PAV', observacion: 'PAV approved. Decreto 2101/11.' },
      { fecha: '01/05/2013', beneficio: 'Jubilación Ordinaria', observacion: 'Jubilación ordinaria concedida.' },
    ],
    telefono: '351 4567890',
    correo: 'eabaca@correo.com',
    programa: 'Programa Previsional Municipal',
    secretaria: 'Secretaría de Recursos Humanos',
    cargo: 'Director General de Administración',
    antiguedadRecibo: '25 años, 4 meses',
    antiguedadLicencias: '1 año, 2 meses',
    fechaNacimiento: '14/08/1958',
    edadActual: '67',
    fechaEstimadaJubilacionOrdinaria: '16/11/2023',
    beneficio: '1',
    nroTramite: '393.297/13',
    fBaja: '01/05/2013',
    nroExpMunRenuncia: '393.297/13',
    jNroExpCaja: '165.857/13',
    nroResRenCaja: '001.181/13',
    nroExpCajDeneg: '',
    fInicExpMunPav: '23/02/2010',
    nroExpedienteMun: '248.241/10',
    fInfPrevCaja: '04/10/2010',
    fecha: '',
    anios: '2',
    meses: '1',
    dias: '12',
    edadReq: '65',
    renovaciones: [
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
    ],
    notificacionArt43: '',
    nExpArt43SuspPago: '',
    fSolicitud: '23/02/2010',
    fEstimadaJOrd: '16/11/2012',
    nroExpPasividad: '248.241/10',
    fFirmaConvenio: '',
    fInicioPasividad: '',
    observacionPasividad: 'PAV A PARTIR DEL 01/07/2011 DECRETO 2101/11',
    observacion: 'PAV A PARTIR DEL 01/07/2011 DECRETO 2101/11',
  },
  {
    id: '2',
    cuil: '20-42659847-9',
    dni: '42659847',
    apellidoNombres: 'AYACUNCHO NAHUEL MOLINA',
    estadoActivo: false,
    trazabilidad: [
      { fecha: '10/03/2012', beneficio: 'PAV en trámite', observacion: 'Expediente iniciado por acuerdo mutual.' },
      { fecha: '01/05/2013', beneficio: 'Jubilación por Invalidez Provisoria', observacion: 'Invalidez provisoria aprobada. Decreto 1780/12.' },
      { fecha: '30/04/2014', beneficio: 'Jubilación por Invalidez Definitiva', observacion: 'Pase a invalidez definitiva.' },
      { fecha: '15/06/2015', beneficio: 'Notificación por cédula', observacion: 'Notificación enviada al domicilio.' },
    ],
    telefono: '351 5551234',
    correo: 'nmolina@correo.com',
    programa: 'Programa Retiro Voluntario',
    secretaria: 'Secretaría de Economía',
    cargo: 'Jefe de Departamento Contable',
    antiguedadRecibo: '18 años, 8 meses',
    antiguedadLicencias: '0 años, 6 meses',
    fechaNacimiento: '05/03/1964',
    edadActual: '62',
    fechaEstimadaJubilacionOrdinaria: '20/08/2024',
    beneficio: '3',
    nroTramite: '210.450/12',
    fBaja: '01/05/2013',
    nroExpMunRenuncia: '210.450/12',
    jNroExpCaja: '182.340/13',
    nroResRenCaja: '002.045/13',
    nroExpCajDeneg: '',
    fInicExpMunPav: '10/03/2012',
    nroExpedienteMun: '310.120/12',
    fInfPrevCaja: '15/06/2012',
    fecha: '',
    anios: '1',
    meses: '3',
    dias: '5',
    edadReq: '60',
    renovaciones: [
      { nroResRenov: 'R-001/13', nroExpMun: '215.300/13', fechaDesdeExp: '01/05/2013', fechaHastaExp: '30/04/2014', jNroExpCaja: '182.340/13', nroDcto: 'D-120' },
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
    ],
    notificacionArt43: '20/04/2013',
    nExpArt43SuspPago: '',
    fSolicitud: '10/03/2012',
    fEstimadaJOrd: '20/08/2013',
    nroExpPasividad: '310.120/12',
    fFirmaConvenio: '25/04/2013',
    fInicioPasividad: '01/05/2013',
    observacionPasividad: 'EXPEDIENTE INICIADO POR ACUERDO MUTUAL. DECRETO 1780/12.',
    observacion: 'EXPEDIENTE INICIADO POR ACUERDO MUTUAL. DECRETO 1780/12.',
  },
  {
    id: '3',
    cuil: '20-15632489-3',
    dni: '15632489',
    apellidoNombres: 'RODRIGUEZ MARTIN ADOLFO',
    estadoActivo: true,
    trazabilidad: [
      { fecha: '15/01/2002', beneficio: 'PAV en trámite', observacion: 'Inicio expediente PAV.' },
      { fecha: '01/07/2003', beneficio: 'Jubilación Ordinaria', observacion: 'Jubilación ordinaria concedida. Resolución 1450/03.' },
    ],
    telefono: '351 4789012',
    correo: 'mrodriguez@correo.com',
    programa: 'Programa Previsional Municipal',
    secretaria: 'Secretaría de Recursos Humanos',
    cargo: 'Supervisor Operativo',
    antiguedadRecibo: '30 años, 1 mes',
    antiguedadLicencias: '2 años, 0 meses',
    fechaNacimiento: '10/11/1957',
    edadActual: '68',
    fechaEstimadaJubilacionOrdinaria: '30/06/2022',
    beneficio: '1',
    nroTramite: '098.774/03',
    fBaja: '02/07/2003',
    nroExpMunRenuncia: '098.774/03',
    jNroExpCaja: '095.432/03',
    nroResRenCaja: '005.112/03',
    nroExpCajDeneg: '045.221/02',
    fInicExpMunPav: '15/01/2002',
    nroExpedienteMun: '110.550/02',
    fInfPrevCaja: '20/03/2002',
    fecha: '',
    anios: '1',
    meses: '6',
    dias: '15',
    edadReq: '65',
    renovaciones: [
      { nroResRenov: 'R-005/03', nroExpMun: '120.010/03', fechaDesdeExp: '01/07/2003', fechaHastaExp: '30/06/2004', jNroExpCaja: '095.432/03', nroDcto: 'D-089' },
      { nroResRenov: 'R-008/04', nroExpMun: '135.220/04', fechaDesdeExp: '01/07/2004', fechaHastaExp: '30/06/2005', jNroExpCaja: '102.110/04', nroDcto: 'D-091' },
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
    ],
    notificacionArt43: '10/06/2003',
    nExpArt43SuspPago: '045.221/02',
    fSolicitud: '15/01/2002',
    fEstimadaJOrd: '30/06/2003',
    nroExpPasividad: '110.550/02',
    fFirmaConvenio: '15/06/2003',
    fInicioPasividad: '01/07/2003',
    observacionPasividad: 'JUBILACION ORDINARIA CONCEDIDA. RESOLUCIÓN 1450/03.',
    observacion: 'JUBILACION ORDINARIA CONCEDIDA. RESOLUCIÓN 1450/03.\nPENSION COMPLEMENTARIA EN TRÁMITE.',
  },
  {
    id: '4',
    cuil: '20-36951472-8',
    dni: '36951472',
    apellidoNombres: 'MESSI LIONEL ANDRES',
    estadoActivo: true,
    trazabilidad: [
      { fecha: '05/02/2019', beneficio: 'PAV en trámite', observacion: 'Inicio de expediente PAV. Decreto 4500/18.' },
      { fecha: '10/11/2020', beneficio: 'Jubilación Ordinaria', observacion: 'Jubilación ordinaria aprobada sin observaciones.' },
    ],
    telefono: '351 6543210',
    correo: 'lmessi@correo.com',
    programa: 'Programa Previsional Municipal',
    secretaria: 'Secretaría de Deportes',
    cargo: 'Coordinador Técnico Previsional',
    antiguedadRecibo: '15 años, 10 meses',
    antiguedadLicencias: '0 años, 3 meses',
    fechaNacimiento: '24/06/1987',
    edadActual: '39',
    fechaEstimadaJubilacionOrdinaria: '24/06/2052',
    beneficio: '1',
    nroTramite: '421.890/20',
    fBaja: ' ',
    nroExpMunRenuncia: '421.890/20',
    jNroExpCaja: '312.550/20',
    nroResRenCaja: '010.789/20',
    nroExpCajDeneg: '',
    fInicExpMunPav: '05/02/2019',
    nroExpedienteMun: '395.110/19',
    fInfPrevCaja: '20/05/2019',
    fecha: '',
    anios: '1',
    meses: '9',
    dias: '5',
    edadReq: '65',
    renovaciones: [
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
      { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
    ],
    notificacionArt43: '',
    nExpArt43SuspPago: '',
    fSolicitud: '05/02/2019',
    fEstimadaJOrd: '10/11/2020',
    nroExpPasividad: '395.110/19',
    fFirmaConvenio: '05/11/2020',
    fInicioPasividad: '10/11/2020',
    observacionPasividad: 'PAV A PARTIR DEL 01/01/2019 DECRETO 4500/18.',
    observacion: 'PAV A PARTIR DEL 01/01/2019 DECRETO 4500/18.\nEXPEDIENTE COMPLETO SIN OBSERVACIONES.',
  },
]

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
  '7':  [
    { label: 'Impresión de Formulario de Solicitud', icon: 'file-text' },
    { label: 'Formulario de Aceptación y Rechazo', icon: 'check-square' },
    { label: 'Pase a Secretaría', icon: 'send' },
  ],
  '8':  [],
  '9':  [],
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
