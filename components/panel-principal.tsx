'use client'

import { useState, useRef } from 'react'
import {
  Search, UserCircle, Pencil, Save, FileText, Upload,
  Printer, Send, Archive, CheckSquare, PlusCircle, GitBranch, X, CheckCircle2,
} from 'lucide-react'
import {
  MOCK_RECORDS,
  BENEFICIO_OPTIONS,
  BOTONES_POR_BENEFICIO,
  type JubilacionRecord,
  type BtnExtra,
  type TrazabilidadEntry,
} from '@/lib/jubilaciones-data'
import { FormField, SelectField, SectionCard } from '@/components/form-field'
import { formatExpediente, formatDate } from '@/lib/format-utils'

// Normalize a string: lowercase + remove diacritics
function normalize(str: string): string {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Render an icon by name string
function BtnIcon({ name }: { name: string }) {
  const cls = 'w-3.5 h-3.5'
  if (name === 'printer')      return <Printer      className={cls} />
  if (name === 'send')         return <Send         className={cls} />
  if (name === 'archive')      return <Archive      className={cls} />
  if (name === 'file-text')    return <FileText     className={cls} />
  if (name === 'check-square') return <CheckSquare  className={cls} />
  return <FileText className={cls} />
}

interface FieldDiff {
  section: string
  label: string
  oldVal: string
  newVal: string
}

function getRecordDiffs(initial: JubilacionRecord | null, current: JubilacionRecord | null): FieldDiff[] {
  if (!initial || !current) return []
  const diffs: FieldDiff[] = []

  const check = (section: string, label: string, key: keyof JubilacionRecord) => {
    const oldV = String(initial[key] ?? '').trim()
    const newV = String(current[key] ?? '').trim()
    if (oldV !== newV) {
      diffs.push({ section, label, oldVal: oldV || '(vacío)', newVal: newV || '(vacío)' })
    }
  }

  // Laboral
  if (initial.beneficio !== current.beneficio) {
    const oldLabel = BENEFICIO_OPTIONS.find((b) => b.value === initial.beneficio)?.label ?? initial.beneficio
    const newLabel = BENEFICIO_OPTIONS.find((b) => b.value === current.beneficio)?.label ?? current.beneficio
    diffs.push({ section: 'INFORMACIÓN LABORAL', label: 'Beneficio', oldVal: oldLabel, newVal: newLabel })
  }
  check('INFORMACIÓN LABORAL', 'Número de Trámite', 'nroTramite')
  check('INFORMACIÓN LABORAL', 'Fecha Baja', 'fBaja')
  check('INFORMACIÓN LABORAL', 'Nº Exp. Mun. Renuncia', 'nroExpMunRenuncia')
  check('INFORMACIÓN LABORAL', 'J. Nº Exp. Caja', 'jNroExpCaja')
  check('INFORMACIÓN LABORAL', 'Nº Res. Caja', 'nroResRenCaja')
  check('INFORMACIÓN LABORAL', 'Nº Exp. Caj. Deneg.', 'nroExpCajDeneg')

  // Renovaciones
  current.renovaciones.forEach((rv, i) => {
    const oldRv = initial.renovaciones[i] || { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', nroDcto: '' }
    if (oldRv.nroResRenov !== rv.nroResRenov) {
      diffs.push({ section: 'OTORGAMIENTO Y RENOVACIÓN PROVISORIAS', label: `Fila #${i + 1} Pase a Repartición`, oldVal: oldRv.nroResRenov || '(vacío)', newVal: rv.nroResRenov || '(vacío)' })
    }
    if (oldRv.nroExpMun !== rv.nroExpMun) {
      diffs.push({ section: 'OTORGAMIENTO Y RENOVACIÓN PROVISORIAS', label: `Fila #${i + 1} N.º Expte. Municipal`, oldVal: oldRv.nroExpMun || '(vacío)', newVal: rv.nroExpMun || '(vacío)' })
    }
    if (oldRv.fechaDesdeExp !== rv.fechaDesdeExp) {
      diffs.push({ section: 'OTORGAMIENTO Y RENOVACIÓN PROVISORIAS', label: `Fila #${i + 1} Fecha Desde`, oldVal: oldRv.fechaDesdeExp || '(vacío)', newVal: rv.fechaDesdeExp || '(vacío)' })
    }
    if (oldRv.fechaHastaExp !== rv.fechaHastaExp) {
      diffs.push({ section: 'OTORGAMIENTO Y RENOVACIÓN PROVISORIAS', label: `Fila #${i + 1} Fecha Hasta`, oldVal: oldRv.fechaHastaExp || '(vacío)', newVal: rv.fechaHastaExp || '(vacío)' })
    }
    if (oldRv.nroDcto !== rv.nroDcto) {
      diffs.push({ section: 'OTORGAMIENTO Y RENOVACIÓN PROVISORIAS', label: `Fila #${i + 1} Decreto/Resolución`, oldVal: oldRv.nroDcto || '(vacío)', newVal: rv.nroDcto || '(vacío)' })
    }
  })

  // Pasividad
  check('PASIVIDAD', 'Fecha de Solicitud', 'fSolicitud')
  check('PASIVIDAD', 'Fecha Est. Jub. Ordinaria', 'fEstimadaJOrd')
  check('PASIVIDAD', 'Número Expediente Pasividad', 'nroExpPasividad')
  check('PASIVIDAD', 'Fecha Firma Convenio', 'fFirmaConvenio')
  check('PASIVIDAD', 'Fecha Inicio Pasividad', 'fInicioPasividad')
  check('PASIVIDAD', 'Observaciones Pasividad', 'observacionPasividad')

  // Notificaciones
  check('NOTIFICACIONES Y SUSPENSIONES', 'Notificación Art. 43', 'notificacionArt43')
  check('NOTIFICACIONES Y SUSPENSIONES', 'N. Exp. Art. 43 Susp. Pago', 'nExpArt43SuspPago')

  // Observaciones
  check('OBSERVACIONES', 'Observación', 'observacion')

  return diffs
}

export default function PanelPrincipal() {
  const [search, setSearch]               = useState('')
  const [selectedId, setSelectedId]       = useState<string | null>(MOCK_RECORDS[MOCK_RECORDS.length - 1].id)
  const [records, setRecords]             = useState<JubilacionRecord[]>(MOCK_RECORDS)
  const [editing, setEditing]                   = useState(false)
  const [notFoundPopup, setNotFoundPopup]       = useState(false)
  const [showTrazabilidad, setShowTrazabilidad] = useState(false)
  const [showConfirmPopup, setShowConfirmPopup] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [showEditConfirmPopup, setShowEditConfirmPopup] = useState(false)
  const [showEditSuccessPopup, setShowEditSuccessPopup] = useState(false)

  const [isCreatingNew, setIsCreatingNew]               = useState(false)
  const [previousSelectedId, setPreviousSelectedId]     = useState<string | null>(null)
  const [initialSnapshot, setInitialSnapshot]           = useState<JubilacionRecord | null>(null)

  const detailRef = useRef<HTMLDivElement>(null)
  const selected  = records.find((r) => r.id === selectedId) ?? null

  // ── Filter (used on click, not reactive) ────────────────────────────────────
  const filterRecords = (q: string) => {
    const norm = normalize(q.trim())
    if (!norm) return records
    return records.filter((r) =>
      r.dni.includes(norm) || normalize(r.apellidoNombres).includes(norm)
    )
  }

  const handleSearchAndLoad = () => {
    const results = filterRecords(search)
    if (results.length >= 1) {
      handleSelect(results[0].id)
    } else {
      setNotFoundPopup(true)
    }
  }

  // ── Mutations ────────────────────────────────────────────────────────────────
  const update = (field: keyof JubilacionRecord, value: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.id === selectedId ? { ...r, [field]: value } : r))
    )
  }

  const updateRenovacion = (idx: number, field: string, value: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.id !== selectedId) return r
        const renovaciones = r.renovaciones.map((rv, i) =>
          i === idx ? { ...rv, [field]: value } : rv
        )
        return { ...r, renovaciones }
      })
    )
  }

  // ── Edit / Save toggle ───────────────────────────────────────────────────────
  const handleSelect = (id: string) => {
    setSelectedId(id)
    setEditing(false)
    setIsCreatingNew(false)
    setInitialSnapshot(null)
    setTimeout(
      () => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      50
    )
  }

  const handleNew = () => {
    if (editing) return
    const newId = String(Date.now())
    const currentBase = selected ?? records[0] ?? MOCK_RECORDS[0]
    setPreviousSelectedId(selectedId)
    const blank: JubilacionRecord = {
      id: newId,
      cuil: currentBase.cuil,
      dni: currentBase.dni,
      apellidoNombres: currentBase.apellidoNombres,
      telefono: currentBase.telefono,
      correo: currentBase.correo,
      programa: currentBase.programa,
      secretaria: currentBase.secretaria,
      cargo: currentBase.cargo,
      antiguedadRecibo: currentBase.antiguedadRecibo,
      antiguedadLicencias: currentBase.antiguedadLicencias,
      fechaNacimiento: currentBase.fechaNacimiento,
      edadActual: currentBase.edadActual,
      fechaEstimadaJubilacionOrdinaria: currentBase.fechaEstimadaJubilacionOrdinaria,
      estadoActivo: true,
      trazabilidad: currentBase.trazabilidad ? [...currentBase.trazabilidad] : [],
      beneficio: '1', nroTramite: '',
      fBaja: '', nroExpMunRenuncia: '', jNroExpCaja: '', nroResRenCaja: '',
      nroExpCajDeneg: '', fInicExpMunPav: '', nroExpedienteMun: '',
      fInfPrevCaja: '', fecha: '', anios: '', meses: '', dias: '', edadReq: '',
      renovaciones: [
        { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
        { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
        { nroResRenov: '', nroExpMun: '', fechaDesdeExp: '', fechaHastaExp: '', jNroExpCaja: '', nroDcto: '' },
      ],
      notificacionArt43: '', nExpArt43SuspPago: '', fSolicitud: '',
      fEstimadaJOrd: '', nroExpPasividad: '', fFirmaConvenio: '',
      fInicioPasividad: '', observacionPasividad: '', observacion: '',
    }
    setInitialSnapshot(JSON.parse(JSON.stringify(blank)))
    setRecords((prev) => [blank, ...prev])
    setSelectedId(newId)
    setIsCreatingNew(true)
    setEditing(true)
  }

  const handleStartEdit = () => {
    if (selected) {
      setInitialSnapshot(JSON.parse(JSON.stringify(selected)))
      setIsCreatingNew(false)
      setEditing(true)
    }
  }

  const handleCancelEdit = () => {
    if (isCreatingNew && selectedId) {
      setRecords((prev) => prev.filter((r) => r.id !== selectedId))
      setSelectedId(previousSelectedId ?? records.find((r) => r.id !== selectedId)?.id ?? null)
    } else if (initialSnapshot && selectedId) {
      setRecords((prev) => prev.map((r) => (r.id === selectedId ? initialSnapshot : r)))
    }
    setEditing(false)
    setIsCreatingNew(false)
    setInitialSnapshot(null)
  }

  const handleToggleEdit = () => {
    if (editing) {
      if (isCreatingNew) {
        setShowConfirmPopup(true)
      } else {
        setShowEditConfirmPopup(true)
      }
    } else {
      handleStartEdit()
    }
  }

  const handleConfirmRegistration = () => {
    setShowConfirmPopup(false)
    setEditing(false)
    setIsCreatingNew(false)
    setInitialSnapshot(null)
    setShowSuccessPopup(true)
  }

  const handleConfirmEdit = () => {
    setShowEditConfirmPopup(false)
    setEditing(false)
    setIsCreatingNew(false)
    setInitialSnapshot(null)
    setShowEditSuccessPopup(true)
  }

  const ro = !editing

  // ── Derived per selected record ──────────────────────────────────────────────
  // Estado activo: inactivo si tiene Fecha Baja, Fecha Inicio Pasividad O si alguna renovación tiene fechas provisorias cargadas
  const isActivo = selected
    ? !selected.fBaja.trim() &&
      !selected.fInicioPasividad.trim() &&
      !selected.renovaciones.some((rv) => rv.fechaDesdeExp.trim() || rv.fechaHastaExp.trim())
    : false
  // Otorgamiento y Renovaciones siempre visible cuando hay registro seleccionado
  const showRenovaciones = true
  const extraBtns: BtnExtra[] = selected ? (BOTONES_POR_BENEFICIO[selected.beneficio] ?? []) : []

  return (
    <div>
      <div>

        {/* ── Sticky status bar ─────────────────────────────────────────────── */}
        {selected && (
          <div
            className={`sticky top-0 z-20 border-b shadow-sm px-6 py-2.5 flex items-center gap-3 ${
              isActivo
                ? 'bg-emerald-600 border-emerald-700'
                : 'bg-red-600 border-red-700'
            }`}
          >
            <UserCircle className="w-4 h-4 text-white flex-shrink-0" />
            <span className="text-sm font-bold text-white truncate">
              {selected.apellidoNombres || 'Nuevo Registro'}
            </span>
            <span className="text-xs font-mono text-white/80 flex-shrink-0">
              DNI: {selected.dni || '—'}
            </span>
            <span
              className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide border flex-shrink-0 ${
                isActivo
                  ? 'bg-emerald-500/40 border-emerald-300 text-white'
                  : 'bg-red-500/40 border-red-300 text-white'
              }`}
            >
              {isActivo ? 'ACTIVO' : 'INACTIVO'}
            </span>
            <span className="ml-auto text-xs text-white/80 flex-shrink-0 truncate max-w-xs">
              {BENEFICIO_OPTIONS.find((b) => b.value === selected.beneficio)?.label ?? '—'}
            </span>
          </div>
        )}

        {/* ── Trazabilidad modal ────────────────────────────────────────────── */}
        {showTrazabilidad && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg mx-4 flex flex-col max-h-[80vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-[#1e3a8a] rounded-t-xl">
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-white" />
                  <h3 className="text-sm font-bold text-white">Trazabilidad de Beneficios</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-blue-200 font-mono">{selected.apellidoNombres} — DNI {selected.dni}</span>
                  <button
                    onClick={() => setShowTrazabilidad(false)}
                    className="text-white/70 hover:text-white transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Timeline */}
              <div className="overflow-y-auto p-5 flex flex-col gap-0">
                {selected.trazabilidad.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Sin historial de trazabilidad.</p>
                ) : (
                  selected.trazabilidad.map((entry: TrazabilidadEntry, idx: number) => (
                    <div key={idx} className="flex gap-4">
                      {/* Timeline line */}
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full border-2 flex-shrink-0 mt-1 ${
                          idx === selected.trazabilidad.length - 1
                            ? 'bg-[#1e3a8a] border-[#1e3a8a]'
                            : 'bg-white border-slate-300'
                        }`} />
                        {idx < selected.trazabilidad.length - 1 && (
                          <div className="w-px flex-1 bg-slate-200 my-1" />
                        )}
                      </div>
                      {/* Content */}
                      <div className={`pb-5 flex-1 ${idx === selected.trazabilidad.length - 1 ? '' : ''}`}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-slate-400">{entry.fecha}</span>
                        </div>
                        <p className="text-sm font-semibold text-[#1e3a8a]">{entry.beneficio}</p>
                        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{entry.observacion}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Footer */}
              <div className="px-5 py-3 border-t border-slate-100 flex justify-end">
                <button
                  onClick={() => setShowTrazabilidad(false)}
                  className="px-4 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-semibold transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Not-found popup ───────────────────────────────────────────────── */}
        {notFoundPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-7 max-w-sm w-full mx-4 flex flex-col items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-amber-50 border border-amber-200">
                <Search className="w-6 h-6 text-amber-500" />
              </div>
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-800 mb-1">Sin resultados</h3>
                <p className="text-sm text-slate-500">
                  No se encontró ningún registro que coincida con la búsqueda.
                </p>
              </div>
              <button
                onClick={() => setNotFoundPopup(false)}
                className="px-5 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-semibold transition"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        {/* ── Confirmation Popup ────────────────────────────────────────────── */}
        {showConfirmPopup && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-[#1e3a8a] text-white">
                <div>
                  <h3 className="text-base font-bold">Confirmación de Registro de Jubilación</h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Se está por registrar una nueva jubilación con todos los datos que se agregaron:
                  </p>
                </div>
                <button
                  onClick={() => setShowConfirmPopup(false)}
                  className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content Body: Formatted Summary by Blocks */}
              <div className="overflow-y-auto p-6 space-y-4 text-xs">
                
                {/* 1. DATOS PERSONALES */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <UserCircle className="w-4 h-4" /> DATOS PERSONALES (PRE-CARGADOS)
                  </h4>
                  <ul className="pl-4 space-y-1.5 text-slate-700 font-mono">
                    <li><span className="font-semibold text-slate-900">Apellido y Nombres:</span> {selected.apellidoNombres || '—'}</li>
                    <li><span className="font-semibold text-slate-900">DNI:</span> {selected.dni || '—'}</li>
                    <li><span className="font-semibold text-slate-900">CUIL:</span> {selected.cuil || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Programa:</span> {selected.programa || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Secretaría:</span> {selected.secretaria || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Cargo:</span> {selected.cargo || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Antigüedad Recibo:</span> {selected.antiguedadRecibo || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Antigüedad Licencias:</span> {selected.antiguedadLicencias || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Fecha Nacimiento:</span> {selected.fechaNacimiento || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Edad Actual:</span> {selected.edadActual || '—'}</li>
                  </ul>
                </div>

                {/* 2. INFORMACIÓN LABORAL */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                    <FileText className="w-4 h-4" /> INFORMACIÓN LABORAL
                  </h4>
                  <ul className="pl-4 space-y-1.5 text-slate-700 font-mono">
                    <li>
                      <span className="font-semibold text-slate-900">Beneficio:</span>{' '}
                      {BENEFICIO_OPTIONS.find((b) => b.value === selected.beneficio)?.label ?? '—'}
                    </li>
                    <li><span className="font-semibold text-slate-900">Número de Trámite:</span> {selected.nroTramite || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Fecha Baja:</span> {selected.fBaja || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Nº Exp. Mun. Renuncia:</span> {selected.nroExpMunRenuncia || '—'}</li>
                    <li><span className="font-semibold text-slate-900">J. Nº Exp. Caja:</span> {selected.jNroExpCaja || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Nº Res. Caja:</span> {selected.nroResRenCaja || '—'}</li>
                    {selected.nroExpCajDeneg && (
                      <li><span className="font-semibold text-slate-900">Nº Exp. Caj. Deneg.:</span> {selected.nroExpCajDeneg}</li>
                    )}
                  </ul>
                </div>

                {/* 3. OTORGAMIENTO Y RENOVACION PROVISORIAS */}
                {selected.renovaciones.some((rv) => rv.nroResRenov || rv.nroExpMun || rv.fechaDesdeExp || rv.fechaHastaExp) && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1">
                      OTORGAMIENTO Y RENOVACIÓN PROVISORIAS
                    </h4>
                    <ul className="pl-4 space-y-2 text-slate-700 font-mono">
                      {selected.renovaciones.map((rv, idx) => (
                        (rv.nroResRenov || rv.nroExpMun || rv.fechaDesdeExp || rv.fechaHastaExp || rv.nroDcto) ? (
                          <li key={idx} className="border-l-2 border-[#1e3a8a] pl-2.5 py-0.5">
                            <span className="font-semibold text-slate-900">Fila #{idx + 1}:</span>
                            {rv.nroResRenov && <div>&nbsp;&nbsp;• Pase a Repartición: {rv.nroResRenov}</div>}
                            {rv.nroExpMun && <div>&nbsp;&nbsp;• N.º Expte. Municipal: {rv.nroExpMun}</div>}
                            {rv.fechaDesdeExp && <div>&nbsp;&nbsp;• Fecha Desde: {rv.fechaDesdeExp}</div>}
                            {rv.fechaHastaExp && <div>&nbsp;&nbsp;• Fecha Hasta: {rv.fechaHastaExp}</div>}
                            {rv.nroDcto && <div>&nbsp;&nbsp;• N.º Decreto/Resolución: {rv.nroDcto}</div>}
                          </li>
                        ) : null
                      ))}
                    </ul>
                  </div>
                )}

                {/* 4. PASIVIDAD */}
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1">
                    PASIVIDAD
                  </h4>
                  <ul className="pl-4 space-y-1.5 text-slate-700 font-mono">
                    <li><span className="font-semibold text-slate-900">Fecha de Solicitud:</span> {selected.fSolicitud || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Fecha Est. Jub. Ordinaria:</span> {selected.fEstimadaJOrd || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Número Expediente Pasividad:</span> {selected.nroExpPasividad || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Fecha Firma Convenio:</span> {selected.fFirmaConvenio || '—'}</li>
                    <li><span className="font-semibold text-slate-900">Fecha Inicio Pasividad:</span> {selected.fInicioPasividad || '—'}</li>
                    {selected.observacionPasividad && (
                      <li><span className="font-semibold text-slate-900">Observaciones Pasividad:</span> {selected.observacionPasividad}</li>
                    )}
                  </ul>
                </div>

                {/* 5. NOTIFICACIONES Y SUSPENSIONES */}
                {(selected.notificacionArt43 || selected.nExpArt43SuspPago) && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1">
                      NOTIFICACIONES Y SUSPENSIONES
                    </h4>
                    <ul className="pl-4 space-y-1.5 text-slate-700 font-mono">
                      {selected.notificacionArt43 && (
                        <li><span className="font-semibold text-slate-900">Notificación Art. 43:</span> {selected.notificacionArt43}</li>
                      )}
                      {selected.nExpArt43SuspPago && (
                        <li><span className="font-semibold text-slate-900">N. Exp. Art. 43 Susp. Pago:</span> {selected.nExpArt43SuspPago}</li>
                      )}
                    </ul>
                  </div>
                )}

                {/* 6. OBSERVACIONES */}
                {selected.observacion && (
                  <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1">
                      OBSERVACIONES
                    </h4>
                    <p className="pl-4 text-slate-700 font-mono whitespace-pre-wrap">{selected.observacion}</p>
                  </div>
                )}

              </div>

              {/* Footer Buttons */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirmPopup(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmRegistration}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Confirmation Popup ───────────────────────────────────────── */}
        {showEditConfirmPopup && selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl flex flex-col max-h-[85vh] overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 bg-[#1e3a8a] text-white">
                <div>
                  <h3 className="text-base font-bold">Confirmación de Edición de Jubilación</h3>
                  <p className="text-xs text-blue-200 mt-0.5">
                    Se están por guardar las siguientes modificaciones en la jubilación de <span className="font-semibold">{selected.apellidoNombres}</span>:
                  </p>
                </div>
                <button
                  onClick={() => setShowEditConfirmPopup(false)}
                  className="text-white/70 hover:text-white transition p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body: Diff List */}
              {(() => {
                const editDiffs = getRecordDiffs(initialSnapshot, selected)
                return (
                  <div className="overflow-y-auto p-6 space-y-4 text-xs">
                    {editDiffs.length === 0 ? (
                      <div className="p-4 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs leading-relaxed">
                        No se detectaron modificaciones en los campos de la jubilación.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {Array.from(new Set(editDiffs.map((d) => d.section))).map((section) => (
                          <div key={section} className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                            <h4 className="font-bold text-[#1e3a8a] text-xs uppercase tracking-wider mb-2.5 border-b border-slate-200 pb-1">
                              {section}
                            </h4>
                            <ul className="pl-2 space-y-2 text-slate-700 font-mono">
                              {editDiffs.filter((d) => d.section === section).map((diff, idx) => (
                                <li key={idx} className="flex flex-col sm:flex-row sm:items-center gap-1 text-xs">
                                  <span className="font-semibold text-slate-900 min-w-[150px]">• {diff.label}:</span>
                                  <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded border border-slate-200">
                                    <span className="line-through text-rose-500 font-medium">{diff.oldVal}</span>
                                    <span className="text-slate-400">→</span>
                                    <span className="text-emerald-700 font-bold">{diff.newVal}</span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditConfirmPopup(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
                >
                  Rechazar / Cancelar
                </button>
                <button
                  onClick={handleConfirmEdit}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition flex items-center gap-2 shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Aceptar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Success Popup ────────────────────────────────────────────── */}
        {showEditSuccessPopup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-slate-200 p-7 max-w-sm w-full mx-4 flex flex-col items-center gap-4 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-100 border border-emerald-200">
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-800 mb-1">¡Edición Exitosa!</h3>
                <p className="text-sm text-slate-600">
                  Se editó con éxito la información de la jubilación.
                </p>
              </div>
              <button
                onClick={() => setShowEditSuccessPopup(false)}
                className="w-full px-5 py-2.5 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-semibold transition shadow"
              >
                Aceptar
              </button>
            </div>
          </div>
        )}

        <div className="p-6">
          <h1 className="text-xl font-bold text-[#1e3a8a] mb-5">Panel Principal</h1>

          {/* ── Search bar ───────────────────────────────────────────────────── */}
          <div className="flex items-center gap-2 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por Documento o Apellido..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleSearchAndLoad()
                }}
                className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition"
              />
            </div>
            <button
              onClick={handleSearchAndLoad}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] text-white text-sm font-semibold transition"
            >
              <Search className="w-4 h-4" />
              Buscar
            </button>
            <button
              onClick={handleNew}
              disabled={editing}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-semibold transition ml-auto ${
                editing
                  ? 'bg-emerald-600/50 cursor-not-allowed opacity-60'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              <PlusCircle className="w-4 h-4" />
              Agregar Nuevo
            </button>
          </div>

          {/* ── Selected record detail ───────────────────────────────────────── */}
          {selected && (
            <div ref={detailRef} className="flex flex-col gap-4">

              {/* Edit/Save header */}
              <div className="flex items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-3">
                  <UserCircle className="w-5 h-5 text-[#1e3a8a]" />
                  <h2 className="text-base font-bold text-slate-800">
                    DATOS:{' '}
                    <span className="text-[#1e3a8a]">
                      {selected.apellidoNombres || 'Nuevo Registro'} &nbsp; {selected.dni}
                    </span>
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowTrazabilidad(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                  >
                    <GitBranch className="w-4 h-4" />
                    <span>Trazabilidad</span>
                  </button>
                  {editing && (
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancelar</span>
                    </button>
                  )}
                  <button
                    onClick={handleToggleEdit}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      editing
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'bg-[#1e3a8a] hover:bg-[#172554] text-white'
                    }`}
                  >
                    {editing ? (
                      <><Save className="w-4 h-4" /><span>Guardar Registro</span></>
                    ) : (
                      <><Pencil className="w-4 h-4" /><span>Editar</span></>
                    )}
                  </button>
                </div>
              </div>

              {/* ── Card 1: Datos Personales (Con fondo verde o rojo clarito según estado) ── */}
              <SectionCard
                title="Datos Personales"
                className={isActivo ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'}
                headerClassName={isActivo ? 'bg-emerald-100/90 border-emerald-200' : 'bg-red-100/90 border-red-200'}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* 1. CUIL (Primero de todo) */}
                  <FormField
                    label="CUIL"
                    value={selected.cuil}
                    onChange={(v) => update('cuil', v)}
                    placeholder="20-00000000-0"
                    readOnly={true}
                  />
                  {/* 2. DNI */}
                  <FormField
                    label="DNI"
                    value={selected.dni}
                    onChange={(v) => update('dni', v)}
                    placeholder="Número de DNI"
                    readOnly={true}
                  />
                  {/* 3. Apellido y Nombres */}
                  <FormField
                    label="Apellido y Nombres"
                    value={selected.apellidoNombres}
                    onChange={(v) => update('apellidoNombres', v)}
                    placeholder="Apellido y Nombres"
                    className="col-span-2"
                    readOnly={true}
                  />
                  {/* 4. Teléfono */}
                  <FormField
                    label="Teléfono"
                    value={selected.telefono}
                    onChange={(v) => update('telefono', v)}
                    placeholder="Número de teléfono"
                    readOnly={true}
                  />
                  {/* 5. Correo Electrónico */}
                  <FormField
                    label="Correo Electrónico"
                    value={selected.correo}
                    onChange={(v) => update('correo', v)}
                    placeholder="correo@ejemplo.com"
                    className="col-span-2"
                    readOnly={true}
                  />
                  {/* 6. Programa */}
                  <FormField
                    label="Programa"
                    value={selected.programa}
                    onChange={(v) => update('programa', v)}
                    placeholder="Programa"
                    readOnly={true}
                  />
                  {/* 7. Secretaría */}
                  <FormField
                    label="Secretaría"
                    value={selected.secretaria}
                    onChange={(v) => update('secretaria', v)}
                    placeholder="Secretaría"
                    readOnly={true}
                  />
                  {/* 8. Cargo (A continuación de Secretaría) */}
                  <FormField
                    label="Cargo"
                    value={selected.cargo}
                    onChange={(v) => update('cargo', v)}
                    placeholder="Cargo desempeñado"
                    readOnly={true}
                  />
                  {/* 9. Antigüedad Recibo */}
                  <FormField
                    label="Antigüedad Recibo"
                    value={selected.antiguedadRecibo}
                    onChange={(v) => update('antiguedadRecibo', v)}
                    placeholder="Ej: 25 años, 4 meses"
                    readOnly={true}
                  />
                  {/* 10. Antigüedad Licencias */}
                  <FormField
                    label="Antigüedad Licencias"
                    value={selected.antiguedadLicencias}
                    onChange={(v) => update('antiguedadLicencias', v)}
                    placeholder="Ej: 1 año, 2 meses"
                    readOnly={true}
                  />
                  {/* 11. Fecha de Nacimiento */}
                  <FormField
                    label="Fecha de Nacimiento"
                    value={selected.fechaNacimiento}
                    onChange={(v) => update('fechaNacimiento', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={true}
                  />
                  {/* 12. Edad Actual */}
                  <FormField
                    label="Edad Actual"
                    value={selected.edadActual}
                    onChange={(v) => update('edadActual', v)}
                    placeholder="Ej: 65"
                    readOnly={true}
                  />
                  {/* 13. Fecha Estimada Jubilación Ordinaria */}
                  <FormField
                    label="Fecha Estimada Jubilación Ordinaria"
                    value={selected.fechaEstimadaJubilacionOrdinaria}
                    onChange={(v) => update('fechaEstimadaJubilacionOrdinaria', v)}
                    placeholder="dd/mm/aaaa"
                    className="col-span-2"
                    readOnly={true}
                  />
                </div>
              </SectionCard>

              {/* ── Card 2: Información Laboral ──────────────────────────────── */}
              <SectionCard title="Información Laboral">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  {/* Beneficio + Nro Tramite en primera fila */}
                  <SelectField
                    label="Beneficio"
                    value={selected.beneficio}
                    onChange={(v) => update('beneficio', v)}
                    options={BENEFICIO_OPTIONS}
                    disabled={ro}
                    className="col-span-2"
                  />
                  <FormField
                    label="Número de Trámite"
                    value={selected.nroTramite}
                    onChange={(v) => update('nroTramite', v)}
                    placeholder="000.000/00"
                    readOnly={ro}
                  />
                  <FormField
                    label="Fecha Baja"
                    value={selected.fBaja}
                    onChange={(v) => update('fBaja', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={ro}
                  />
                  <FormField
                    label="Nº Exp. Mun. Renuncia"
                    value={selected.nroExpMunRenuncia}
                    onChange={(v) => update('nroExpMunRenuncia', v)}
                    placeholder="000.000/00"
                    readOnly={ro}
                  />
                  <FormField
                    label="J. Nº Exp. Caja"
                    value={selected.jNroExpCaja}
                    onChange={(v) => update('jNroExpCaja', v)}
                    placeholder="000.000/00"
                    readOnly={ro}
                  />
                  <FormField
                    label="Nº Res. Caja"
                    value={selected.nroResRenCaja}
                    onChange={(v) => update('nroResRenCaja', v)}
                    placeholder="000.000/00"
                    readOnly={ro}
                  />
                  {/* Nº Exp. Caj. Deneg. al final */}
                  <FormField
                    label="Nº Exp. Caj. Deneg."
                    value={selected.nroExpCajDeneg}
                    onChange={(v) => update('nroExpCajDeneg', v)}
                    placeholder="000.000/00"
                    readOnly={ro}
                  />
                </div>

                {/* Botones dinámicos según beneficio */}
                <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                  {/* Siempre presentes */}
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Ver PDF / Imágenes
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Cargar PDF / Imágenes
                  </button>
                  {/* Variables según beneficio */}
                  {extraBtns.map((btn) => (
                    <button
                      key={btn.label}
                      type="button"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-[#1e3a8a] hover:bg-[#172554] text-white transition"
                    >
                      <BtnIcon name={btn.icon} />
                      {btn.label}
                    </button>
                  ))}
                </div>
              </SectionCard>

              {/* ── Card 3: Otorgamiento y Renovaciones (solo Invalidez Provisoria) */}
              {showRenovaciones && (
                <SectionCard title="OTORGAMIENTO Y RENOVACION PROVISORIAS">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          {['#', 'Pase a Repartición', 'N.º Expte. Municipal de Renuncia', 'Fecha Desde Provisoria', 'Fecha Hasta Provisoria', 'N.º de Decreto/Resolución Municipal'].map((h) => (
                            <th
                              key={h}
                              className="text-left px-2 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider whitespace-nowrap"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selected.renovaciones.map((rv, i) => (
                          <tr key={i} className="hover:bg-blue-50/30">
                            <td className="px-2 py-1.5 text-slate-400 font-medium">{i + 1}</td>
                            {(
                              ['nroResRenov', 'nroExpMun', 'fechaDesdeExp', 'fechaHastaExp', 'nroDcto'] as const
                            ).map((field) => (
                              <td key={field} className="px-1 py-1">
                                <input
                                  type="text"
                                  value={rv[field]}
                                  onChange={(e) => {
                                    let val = e.target.value
                                    if (field === 'fechaDesdeExp' || field === 'fechaHastaExp') {
                                      val = formatDate(val)
                                    } else if (field === 'nroExpMun') {
                                      val = formatExpediente(val)
                                    }
                                    updateRenovacion(i, field, val)
                                  }}
                                  readOnly={ro}
                                  placeholder={
                                    field === 'fechaDesdeExp' || field === 'fechaHastaExp'
                                      ? 'dd/mm/aaaa'
                                      : field === 'nroExpMun'
                                      ? '000.000/00'
                                      : '—'
                                  }
                                  className={`w-full rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-200 focus:border-[#1e3a8a] transition min-w-[90px] ${
                                    ro ? 'bg-slate-50 text-slate-500 cursor-default' : ''
                                  }`}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              )}

              {/* ── Card 4: Pasividad ─────────────────────────────────────────── */}
              <SectionCard title="Pasividad">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <FormField
                    label="Fecha de Solicitud"
                    value={selected.fSolicitud}
                    onChange={(v) => update('fSolicitud', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={ro}
                  />
                  <FormField
                    label="Fecha Estimada Jubilación Ordinaria"
                    value={selected.fEstimadaJOrd}
                    onChange={(v) => update('fEstimadaJOrd', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={ro}
                  />
                  <FormField
                    label="Número Expediente Pasividad"
                    value={selected.nroExpPasividad}
                    onChange={(v) => update('nroExpPasividad', v)}
                    placeholder="000.000/00"
                    readOnly={ro}
                  />
                  <FormField
                    label="Fecha Firma Convenio"
                    value={selected.fFirmaConvenio}
                    onChange={(v) => update('fFirmaConvenio', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={ro}
                  />
                  <FormField
                    label="Fecha Inicio Pasividad"
                    value={selected.fInicioPasividad}
                    onChange={(v) => update('fInicioPasividad', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={ro}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Observaciones
                  </label>
                  <textarea
                    value={selected.observacionPasividad}
                    onChange={(e) => update('observacionPasividad', e.target.value)}
                    readOnly={ro}
                    rows={3}
                    placeholder="Observaciones de pasividad..."
                    className={`rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition resize-none leading-relaxed ${
                      ro ? 'bg-slate-50 text-slate-500 cursor-default' : ''
                    }`}
                  />
                </div>
              </SectionCard>

              {/* ── Card 5: Notificaciones y Suspensiones ────────────────────── */}
              <SectionCard title="Notificaciones y Suspensiones">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    label="Notificación Artículo 43"
                    value={selected.notificacionArt43}
                    onChange={(v) => update('notificacionArt43', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={ro}
                  />
                  <FormField
                    label="N. Exp. Art. 43 Susp. Pago"
                    value={selected.nExpArt43SuspPago}
                    onChange={(v) => update('nExpArt43SuspPago', v)}
                    placeholder="000.000/00"
                    readOnly={ro}
                  />
                </div>
              </SectionCard>

              {/* ── Card 6: Observaciones ────────────────────────────────────── */}
              <SectionCard title="Observaciones">
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Observación
                  </label>
                  <textarea
                    value={selected.observacion}
                    onChange={(e) => update('observacion', e.target.value)}
                    readOnly={ro}
                    rows={5}
                    placeholder="Ingrese observaciones del sistema..."
                    className={`rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition resize-none leading-relaxed font-mono ${
                      ro ? 'bg-slate-50 text-slate-500 cursor-default' : ''
                    }`}
                  />
                </div>
              </SectionCard>

            </div>
          )}
        </div>
      </div>
    </div>
  )
}
