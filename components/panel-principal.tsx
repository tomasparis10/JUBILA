'use client'

import { useState, useRef } from 'react'
import {
  Search, UserCircle, Pencil, Save, FileText, Upload,
  Printer, Send, Archive, CheckSquare, PlusCircle, GitBranch, X,
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

export default function PanelPrincipal() {
  const [search, setSearch]               = useState('')
  const [selectedId, setSelectedId]       = useState<string | null>(MOCK_RECORDS[MOCK_RECORDS.length - 1].id)
  const [records, setRecords]             = useState<JubilacionRecord[]>(MOCK_RECORDS)
  const [editing, setEditing]                   = useState(false)
  const [notFoundPopup, setNotFoundPopup]       = useState(false)
  const [showTrazabilidad, setShowTrazabilidad] = useState(false)

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
  const handleToggleEdit = () => setEditing((prev) => !prev)

  const handleSelect = (id: string) => {
    setSelectedId(id)
    setEditing(false)
    setTimeout(
      () => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      50
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

  const handleNew = () => {
    const newId = String(Date.now())
    const blank: JubilacionRecord = {
      id: newId, cuil: '', dni: '', apellidoNombres: '', estadoActivo: true, trazabilidad: [],
      telefono: '', correo: '',
      programa: '', secretaria: '', cargo: '', antiguedadRecibo: '', antiguedadLicencias: '',
      fechaNacimiento: '', edadActual: '', fechaEstimadaJubilacionOrdinaria: '',
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
    setRecords((prev) => [blank, ...prev])
    setSelectedId(newId)
    setEditing(true)
  }

  const ro = !editing

  // ── Derived per selected record ──────────────────────────────────────────────
  // Estado activo: inactivo si tiene Fecha Baja O si alguna renovación tiene fechas provisorias cargadas
  const isActivo = selected
    ? !selected.fBaja.trim() &&
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
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition ml-auto"
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

              {/* ── Card 1: Datos Personales (Con fondo verde clarito) ──────────────── */}
              <SectionCard
                title="Datos Personales"
                className="bg-emerald-50/70 border-emerald-200"
                headerClassName="bg-emerald-100/90 border-emerald-200"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {/* 1. CUIL (Primero de todo) */}
                  <FormField
                    label="CUIL"
                    value={selected.cuil}
                    onChange={(v) => update('cuil', v)}
                    placeholder="20-00000000-0"
                    readOnly={ro}
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
                    readOnly={ro}
                  />
                  {/* 5. Correo Electrónico */}
                  <FormField
                    label="Correo Electrónico"
                    value={selected.correo}
                    onChange={(v) => update('correo', v)}
                    placeholder="correo@ejemplo.com"
                    className="col-span-2"
                    readOnly={ro}
                  />
                  {/* 6. Programa */}
                  <FormField
                    label="Programa"
                    value={selected.programa}
                    onChange={(v) => update('programa', v)}
                    placeholder="Programa"
                    readOnly={ro}
                  />
                  {/* 7. Secretaría */}
                  <FormField
                    label="Secretaría"
                    value={selected.secretaria}
                    onChange={(v) => update('secretaria', v)}
                    placeholder="Secretaría"
                    readOnly={ro}
                  />
                  {/* 8. Cargo (A continuación de Secretaría) */}
                  <FormField
                    label="Cargo"
                    value={selected.cargo}
                    onChange={(v) => update('cargo', v)}
                    placeholder="Cargo desempeñado"
                    readOnly={ro}
                  />
                  {/* 9. Antigüedad Recibo */}
                  <FormField
                    label="Antigüedad Recibo"
                    value={selected.antiguedadRecibo}
                    onChange={(v) => update('antiguedadRecibo', v)}
                    placeholder="Ej: 25 años, 4 meses"
                    readOnly={ro}
                  />
                  {/* 10. Antigüedad Licencias */}
                  <FormField
                    label="Antigüedad Licencias"
                    value={selected.antiguedadLicencias}
                    onChange={(v) => update('antiguedadLicencias', v)}
                    placeholder="Ej: 1 año, 2 meses"
                    readOnly={ro}
                  />
                  {/* 11. Fecha de Nacimiento */}
                  <FormField
                    label="Fecha de Nacimiento"
                    value={selected.fechaNacimiento}
                    onChange={(v) => update('fechaNacimiento', v)}
                    placeholder="dd/mm/aaaa"
                    readOnly={ro}
                  />
                  {/* 12. Edad Actual */}
                  <FormField
                    label="Edad Actual"
                    value={selected.edadActual}
                    onChange={(v) => update('edadActual', v)}
                    placeholder="Ej: 65"
                    readOnly={ro}
                  />
                  {/* 13. Fecha Estimada Jubilación Ordinaria */}
                  <FormField
                    label="Fecha Estimada Jubilación Ordinaria"
                    value={selected.fechaEstimadaJubilacionOrdinaria}
                    onChange={(v) => update('fechaEstimadaJubilacionOrdinaria', v)}
                    placeholder="dd/mm/aaaa"
                    className="col-span-2"
                    readOnly={ro}
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
                                  onChange={(e) => updateRenovacion(i, field, e.target.value)}
                                  readOnly={ro}
                                  placeholder="—"
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
