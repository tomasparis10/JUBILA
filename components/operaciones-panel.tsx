'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  RefreshCw, UserCheck, AlertCircle, CheckCircle2,
  Loader2, Clock, Users, X, UserCircle, Save, Search, ArrowRight,
  FileText, Database, Upload, ChevronDown, ChevronUp, ShieldAlert,
  Pencil, UserCog,
} from 'lucide-react'
import { createAgente, searchAgentes, updateAgenteDatos } from '@/app/actions/agentes'
import { FormField, SelectField } from '@/components/form-field'
import { formatCuil, extractDniFromCuil } from '@/lib/format-utils'
import type { JubilacionRecord } from '@/lib/jubilaciones-data'
import type { AnalysisResult, AnalyzeApiResponse, CommitApiResponse } from '@/lib/bulk-sync/types'

type OpMode = 'agregar-agente' | 'actualizacion-masiva'

interface OperacionesPanelProps {
  activeOp: OpMode | null
  onChangeOp: (op: OpMode) => void
}

// ── Formulario Gestión de Agentes (Crear + Editar + Grilla) ──────────────────
function GestionAgentes() {
  // ── Estado del formulario ────────────────────────────────────────────────
  const emptyForm = (): Partial<JubilacionRecord> => ({
    cuil: '', dni: '', apellidoNombres: '', sexo: '', estadoActivo: true, telefono: '',
    correo: '', fechaNacimiento: '', edadActual: '',
    programa: '', secretaria: '', cargo: '',
    antiguedadRecibo: '', antiguedadLicencias: '',
    fechaEstimadaJubilacionOrdinaria: '',
  })

  const [form, setForm] = useState<Partial<JubilacionRecord>>(emptyForm())
  const [editingAgente, setEditingAgente] = useState<JubilacionRecord | null>(null) // null = modo crear
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formSuccess, setFormSuccess] = useState<string | null>(null)

  // ── Estado de la grilla ──────────────────────────────────────────────────
  const [gridSearch, setGridSearch] = useState('')
  const [gridResults, setGridResults] = useState<JubilacionRecord[]>([])
  const [gridLoading, setGridLoading] = useState(false)
  const [gridError, setGridError] = useState<string | null>(null)
  const [selectedGridId, setSelectedGridId] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const formTopRef = useRef<HTMLDivElement>(null)

  // ── Modo edición vs creación ─────────────────────────────────────────────
  const isEditing = editingAgente !== null

  const update = (field: keyof JubilacionRecord, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleCuilChange = (raw: string) => {
    const cuil = formatCuil(raw)
    const dni = extractDniFromCuil(raw)
    setForm((prev) => ({ ...prev, cuil, dni }))
  }

  const handleReset = () => {
    setForm(emptyForm())
    setEditingAgente(null)
    setSelectedGridId(null)
    setFormError(null)
    setFormSuccess(null)
  }

  // ── Seleccionar un agente de la grilla ────────────────────────────────────
  const handleSelectFromGrid = (agente: JubilacionRecord) => {
    setSelectedGridId(agente.id)
    setEditingAgente(agente)
    setForm({
      cuil: agente.cuil,
      dni: agente.dni,
      apellidoNombres: agente.apellidoNombres,
      sexo: agente.sexo,
      estadoActivo: agente.estadoActivo,
      telefono: agente.telefono,
      correo: agente.correo,
      fechaNacimiento: agente.fechaNacimiento,
      edadActual: agente.edadActual,
      programa: agente.programa,
      secretaria: agente.secretaria,
      cargo: agente.cargo,
      antiguedadRecibo: agente.antiguedadRecibo,
      antiguedadLicencias: agente.antiguedadLicencias,
      fechaEstimadaJubilacionOrdinaria: agente.fechaEstimadaJubilacionOrdinaria,
    })
    setFormError(null)
    setFormSuccess(null)
    // Scroll al formulario
    setTimeout(() => formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  // ── Guardar (crear o editar) ──────────────────────────────────────────────
  const handleSave = async () => {
    setFormError(null)
    setFormSuccess(null)
    if (!form.dni) { setFormError('El DNI es obligatorio.'); return }
    if (!form.apellidoNombres) { setFormError('El Apellido y Nombres son obligatorios.'); return }
    if (!form.sexo) { setFormError('Debe seleccionar el Sexo.'); return }

    setSaving(true)
    try {
      if (isEditing && editingAgente) {
        // Modo editar: extraer ID numérico del agente
        const rawId = editingAgente.id
        const numericId = editingAgente.agenteId ?? (rawId.startsWith('agente-')
          ? parseInt(rawId.replace('agente-', ''), 10)
          : NaN)

        if (isNaN(numericId)) {
          setFormError('No se pudo determinar el ID del agente para editar.')
          return
        }

        const result = await updateAgenteDatos(numericId, {
          cuil: form.cuil ?? '',
          dni: form.dni ?? '',
          apellidoNombres: form.apellidoNombres ?? '',
          sexo: form.sexo ?? '',
          estadoActivo: form.estadoActivo ?? true,
          telefono: form.telefono ?? '',
          correo: form.correo ?? '',
          fechaNacimiento: form.fechaNacimiento ?? '',
          edadActual: form.edadActual ?? '',
          programa: form.programa ?? '',
          secretaria: form.secretaria ?? '',
          cargo: form.cargo ?? '',
          antiguedadRecibo: form.antiguedadRecibo ?? '',
          antiguedadLicencias: form.antiguedadLicencias ?? '',
          fechaEstimadaJubilacionOrdinaria: form.fechaEstimadaJubilacionOrdinaria ?? '',
        })

        if (result.ok) {
          setFormSuccess(`Agente ${form.apellidoNombres} actualizado correctamente.`)
          // Refrescar la fila en la grilla
          if (result.record) {
            setGridResults((prev) =>
              prev.map((a) => (a.agenteId === editingAgente.agenteId ? result.record! : a))
            )
            setEditingAgente(result.record)
            setSelectedGridId(result.record.id)
          }
        } else {
          setFormError(result.error ?? 'Error al actualizar.')
        }
      } else {
        // Modo crear
        const result = await createAgente(form)
        if (result.ok) {
          setFormSuccess('¡Agente registrado con éxito!')
          if (result.record) {
            setGridResults((prev) => [result.record!, ...prev].slice(0, 100))
            setHasSearched(true)
          }
          setForm(emptyForm())
          setEditingAgente(null)
          setSelectedGridId(null)
        } else {
          setFormError(result.error ?? 'Error al guardar.')
        }
      }
    } catch {
      setFormError('Error inesperado al guardar.')
    } finally {
      setSaving(false)
    }
  }

  // ── Búsqueda en la grilla ─────────────────────────────────────────────────
  const handleGridSearch = useCallback(async () => {
    const q = gridSearch.trim()
    setGridLoading(true)
    setGridError(null)
    setHasSearched(true)
    try {
      const results = await searchAgentes(q)
      setGridResults(results)
    } catch {
      setGridError('Error al buscar en la base de datos.')
    } finally {
      setGridLoading(false)
    }
  }, [gridSearch])

  useEffect(() => {
    let active = true
    setGridLoading(true)
    searchAgentes('')
      .then((results) => {
        if (!active) return
        setGridResults(results)
        setHasSearched(true)
      })
      .catch(() => {
        if (active) setGridError('Error al cargar los agentes.')
      })
      .finally(() => {
        if (active) setGridLoading(false)
      })
    return () => { active = false }
  }, [])

  return (
    <div className="flex flex-col gap-5" ref={formTopRef}>
      {/* ── Header info ── */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <UserCog className="w-5 h-5 text-[#1e3a8a] mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-[#1e3a8a]">
            {isEditing ? `Editando: ${editingAgente?.apellidoNombres || '—'}` : 'Agregar Nuevo Agente'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            {isEditing
              ? 'Modifique los datos necesarios y presione Guardar Cambios.'
              : 'Complete los datos personales del nuevo agente. El estado se establecerá como ACTIVO por defecto.'}
          </p>
        </div>
        {isEditing && (
          <button
            onClick={handleReset}
            title="Cancelar edición y limpiar formulario"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" /> Cancelar edición
          </button>
        )}
      </div>

      {/* ── Success banner ── */}
      {formSuccess && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-emerald-700 flex-1">{formSuccess}</span>
          <button onClick={() => setFormSuccess(null)} className="text-emerald-500 hover:text-emerald-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Error banner ── */}
      {formError && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{formError}</span>
          <button onClick={() => setFormError(null)} className="text-red-400 hover:text-red-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Formulario ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest">Datos Personales</h3>
          {isEditing && (
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Pencil className="w-2.5 h-2.5" /> Modo Edición
            </span>
          )}
        </div>
        <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <FormField
            label="CUIL"
            value={form.cuil ?? ''}
            onChange={handleCuilChange}
            placeholder="20-00000000-0"
            mask="cuil"
          />
          <FormField
            label="DNI"
            value={form.dni ?? ''}
            onChange={(v) => update('dni', v.replace(/\D/g, ''))}
            placeholder="Número de DNI"
          />
          <FormField
            label="Apellido y Nombres"
            value={form.apellidoNombres ?? ''}
            onChange={(v) => update('apellidoNombres', v)}
            placeholder="Apellido y Nombres"
            className="col-span-2"
            mask="letters"
          />
          <SelectField
            label="Sexo"
            value={form.sexo ?? ''}
            onChange={(v) => update('sexo', v)}
            options={[
              { value: '', label: 'Seleccionar...' },
              { value: 'Masculino', label: 'Masculino' },
              { value: 'Femenino', label: 'Femenino' },
            ]}
          />
          <SelectField
            label="Estado"
            value={form.estadoActivo === false ? 'inactivo' : 'activo'}
            onChange={(v) => setForm((prev) => ({ ...prev, estadoActivo: v === 'activo' }))}
            options={[
              { value: 'activo', label: 'Activo' },
              { value: 'inactivo', label: 'Inactivo' },
            ]}
          />
          <FormField
            label="Teléfono"
            value={form.telefono ?? ''}
            onChange={(v) => update('telefono', v.replace(/\D/g, ''))}
            placeholder="Número de teléfono"
          />
          <FormField
            label="Correo Electrónico"
            value={form.correo ?? ''}
            onChange={(v) => update('correo', v)}
            placeholder="correo@ejemplo.com"
            className="col-span-2"
          />
          <FormField
            label="Fecha de Nacimiento"
            value={form.fechaNacimiento ?? ''}
            onChange={(v) => update('fechaNacimiento', v)}
            placeholder="dd/mm/aaaa"
            mask="date"
          />
          <FormField
            label="Edad Actual"
            value={form.edadActual ?? ''}
            onChange={(v) => update('edadActual', v.replace(/\D/g, ''))}
            placeholder="Edad"
          />
          <FormField
            label="Programa"
            value={form.programa ?? ''}
            onChange={(v) => update('programa', v)}
            placeholder="Programa"
          />
          <FormField
            label="Secretaría"
            value={form.secretaria ?? ''}
            onChange={(v) => update('secretaria', v)}
            placeholder="Secretaría"
          />
          <FormField
            label="Cargo"
            value={form.cargo ?? ''}
            onChange={(v) => update('cargo', v)}
            placeholder="Cargo desempeñado"
          />
          <FormField
            label="Antigüedad Recibo"
            value={form.antiguedadRecibo ?? ''}
            onChange={(v) => update('antiguedadRecibo', v)}
            placeholder="Ej: 10 años, 2 meses"
          />
          <FormField
            label="Antigüedad Licencias"
            value={form.antiguedadLicencias ?? ''}
            onChange={(v) => update('antiguedadLicencias', v)}
            placeholder="Ej: 10 años, 2 meses"
          />
          <FormField
            label="Fecha Estimada de Jubilación"
            value={form.fechaEstimadaJubilacionOrdinaria ?? ''}
            onChange={(v) => update('fechaEstimadaJubilacionOrdinaria', v)}
            placeholder="dd/mm/aaaa"
            mask="date"
          />
        </div>
      </div>

      {/* ── Acciones ── */}
      <div className="flex items-center gap-3 justify-end">
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
        >
          {isEditing ? 'Cancelar' : 'Limpiar'}
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : isEditing ? 'Guardar Cambios' : 'Guardar Agente'}
        </button>
      </div>

      {/* ── Separador ── */}
      <div className="border-t border-slate-200 pt-1">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-bold text-slate-700">Listado de Agentes</h3>
          <span className="text-xs text-slate-400 ml-auto">Se muestran hasta 100 agentes. Buscá por DNI o Apellido para filtrar.</span>
        </div>
      </div>

      {/* ── Barra de búsqueda de la grilla ── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por DNI o Apellido..."
            value={gridSearch}
            onChange={(e) => setGridSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) handleGridSearch() }}
            className="pl-9 pr-4 py-2 w-full rounded-lg border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-[#1e3a8a] transition"
          />
        </div>
        <button
          onClick={handleGridSearch}
          disabled={gridLoading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition"
        >
          {gridLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {gridLoading ? 'Buscando...' : gridSearch.trim() ? 'Buscar' : 'Mostrar todos'}
        </button>
      </div>

      {/* ── Error grilla ── */}
      {gridError && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{gridError}</span>
        </div>
      )}

      {/* ── Grilla ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest">
             {hasSearched ? `${gridResults.length} agente${gridResults.length !== 1 ? 's' : ''}` : 'Agentes'}
          </span>
          {selectedGridId && (
            <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
              Agente seleccionado
            </span>
          )}
        </div>

        {!hasSearched ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <Search className="w-8 h-8 opacity-30" />
            <p className="text-sm">Cargando agentes...</p>
          </div>
        ) : gridResults.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
            <Users className="w-8 h-8 opacity-30" />
            <p className="text-sm">No se encontraron agentes con esa búsqueda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider w-28">DNI</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider">Apellido y Nombres</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider hidden md:table-cell">Cargo</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Secretaría</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-600 uppercase tracking-wider w-24">Estado</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-600 uppercase tracking-wider w-20">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {gridResults.map((agente) => {
                  const isSelected = selectedGridId === agente.id
                  return (
                    <tr
                      key={agente.id}
                      onClick={() => handleSelectFromGrid(agente)}
                      className={`cursor-pointer transition ${
                        isSelected
                          ? 'bg-blue-50 border-l-2 border-l-[#1e3a8a]'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2.5 font-mono text-slate-600">{agente.dni || '—'}</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{agente.apellidoNombres || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden md:table-cell truncate max-w-[120px]">{agente.cargo || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden lg:table-cell truncate max-w-[120px]">{agente.secretaria || '—'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          agente.estadoActivo
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                            : 'bg-red-50 border-red-200 text-red-700'
                        }`}>
                          {agente.estadoActivo ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleSelectFromGrid(agente) }}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-semibold transition border ${
                            isSelected
                              ? 'bg-[#1e3a8a] text-white border-[#1e3a8a]'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-200 hover:text-[#1e3a8a]'
                          }`}
                        >
                          <Pencil className="w-3 h-3" />
                          {isSelected ? 'Editando' : 'Editar'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}


// ── Sub-componente: FileDropZone ──────────────────────────────────────────────
interface FileDropZoneProps {
  label: string
  accept?: string
  file: File | null
  onFile: (f: File | null) => void
  disabled?: boolean
}

function FileDropZone({ label, accept = '.xlsx,.xls', file, onFile, disabled }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (disabled) return
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }, [disabled, onFile])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    onFile(f)
    // Reset input para permitir reseleccionar el mismo archivo
    e.target.value = ''
  }

  const sizeStr = file
    ? file.size > 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
      : `${(file.size / 1024).toFixed(0)} KB`
    : null

  return (
    <div
      className={`relative border-2 border-dashed rounded-xl p-4 transition cursor-pointer select-none
        ${dragging ? 'border-[#1e3a8a] bg-blue-50' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'}
        ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
        ${file ? 'border-emerald-400 bg-emerald-50' : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleChange} disabled={disabled} />
      {file ? (
        <div className="flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-emerald-700 truncate">{file.name}</p>
            <p className="text-xs text-emerald-500">{sizeStr}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onFile(null) }}
            className="text-slate-400 hover:text-red-500 transition flex-shrink-0"
            disabled={disabled}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Upload className="w-5 h-5 text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-600">{label}</p>
            <p className="text-xs text-slate-400">Arrastrá o hacé click para seleccionar</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-componente: ErrorList ─────────────────────────────────────────────────
function ErrorList({ errors }: { errors: AnalysisResult['datosPersonales']['errores'] }) {
  if (!errors.length) return null
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-red-100 border-b border-red-200 flex items-center gap-2">
        <ShieldAlert className="w-4 h-4 text-red-600" />
        <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
          {errors.length} error{errors.length !== 1 ? 'es' : ''}
        </span>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-red-100">
        {errors.map((e, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-mono">
                Fila {e.rowIndex}
              </span>
              <span className="text-[10px] font-mono text-slate-500">{e.campo}</span>
              {e.valor && (
                <span className="text-[10px] text-slate-400 italic">"{e.valor}"</span>
              )}
            </div>
            <p className="text-xs text-red-600 mt-0.5">{e.descripcion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function WarningList({ items, title }: {
  items: Array<{ rowIndex: number; campo: string; valor: string; descripcion: string }>
  title: string
}) {
  if (!items.length) return null
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-amber-100 border-b border-amber-200 flex items-center gap-2">
        <AlertCircle className="w-4 h-4 text-amber-600" />
        <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
          {items.length} {title}
        </span>
      </div>
      <div className="max-h-40 overflow-y-auto divide-y divide-amber-100">
        {items.map((item, i) => (
          <div key={i} className="px-3 py-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-mono">
                Fila {item.rowIndex}
              </span>
              <span className="text-[10px] font-mono text-slate-500">{item.campo}</span>
              <span className="text-[10px] text-slate-400 italic">"{item.valor}"</span>
            </div>
            <p className="text-xs text-amber-700 mt-0.5">{item.descripcion}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Sub-componente: DiffList expandible ──────────────────────────────────────
function DiffListDP({ items }: { items: AnalysisResult['datosPersonales']['actualizadas'] }) {
  const [expanded, setExpanded] = useState(false)
  const displayed = expanded ? items : items.slice(0, 5)
  return (
    <div>
      <div className="max-h-56 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {displayed.map((a) => (
          <div key={a.dni} className="px-3 py-2 hover:bg-slate-50 transition">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-600">{a.dni}</span>
              <span className="text-xs text-slate-400">—</span>
              <span className="text-xs font-semibold text-slate-700">{a.nombre}</span>
            </div>
            {a.diffs.map((d) => (
              <div key={d.campo} className="flex items-center gap-1.5 pl-4 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400 w-36 shrink-0">{d.campo}</span>
                <span className="text-[10px] text-red-500 line-through max-w-[80px] truncate">{d.anterior || '—'}</span>
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="text-[10px] text-emerald-600 font-semibold max-w-[80px] truncate">{d.nuevo || '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Ver menos' : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  )
}

function DiffListCA({ items }: { items: AnalysisResult['carreraAdministrativa']['actualizadas'] }) {
  const [expanded, setExpanded] = useState(false)
  const displayed = expanded ? items : items.slice(0, 5)
  return (
    <div>
      <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
        {displayed.map((c, i) => (
          <div key={`${c.dni}-${i}`} className="px-3 py-2 hover:bg-slate-50 transition">
            <div className="flex items-center gap-2 mb-1 text-xs">
              <span className="font-mono text-slate-600">{c.dni}</span>
              <span className="text-slate-400">alta: {c.fechaAltaStr}</span>
            </div>
            {c.diffs.map((d) => (
              <div key={d.campo} className="flex items-center gap-1.5 pl-4 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400 w-24 shrink-0">{d.campo}</span>
                <span className="text-[10px] text-red-500 line-through">{d.anterior || '—'}</span>
                <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                <span className="text-[10px] text-emerald-600 font-semibold">{d.nuevo || '—'}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      {items.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 transition"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Ver menos' : `Ver todos (${items.length})`}
        </button>
      )}
    </div>
  )
}

// ── Estados del flujo ─────────────────────────────────────────────────────────
type FlowState =
  | 'idle'           // esperando archivos
  | 'ready'          // archivos seleccionados, listo para analizar
  | 'analyzing'      // analizando (sin escribir)
  | 'preview'        // muestra previsualización, esperando confirmación
  | 'committing'     // escribiendo en DB
  | 'done'           // finalizado con éxito
  | 'error'          // error en alguna etapa

// ── Panel Actualización Masiva ────────────────────────────────────────────────
function ActualizacionMasiva() {
  const [dpFile, setDpFile] = useState<File | null>(null)
  const [caFile, setCaFile] = useState<File | null>(null)
  const [flowState, setFlowState] = useState<FlowState>('idle')
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null)
  const [commitResult, setCommitResult] = useState<CommitApiResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const canAnalyze = dpFile && caFile && (flowState === 'idle' || flowState === 'ready' || flowState === 'error')
  const isLocked = flowState === 'analyzing' || flowState === 'committing'

  const handleDpFile = (f: File | null) => {
    setDpFile(f)
    resetToIdle()
  }
  const handleCaFile = (f: File | null) => {
    setCaFile(f)
    resetToIdle()
  }

  const resetToIdle = () => {
    setAnalysis(null)
    setCommitResult(null)
    setErrorMsg(null)
    setFlowState(dpFile || caFile ? 'ready' : 'idle')
  }

  const handleAnalyze = async () => {
    if (!dpFile || !caFile) return
    setFlowState('analyzing')
    setErrorMsg(null)
    setAnalysis(null)

    try {
      const form = new FormData()
      form.append('datosPersonales', dpFile)
      form.append('carreraAdministrativa', caFile)

      const res = await fetch('/api/bulk-sync/analyze', { method: 'POST', body: form })
      const data: AnalyzeApiResponse = await res.json()

      if (!data.ok || !data.analysis) {
        setErrorMsg(data.error ?? 'Error durante el análisis.')
        setFlowState('error')
        return
      }

      setAnalysis(data.analysis)
      setFlowState('preview')
    } catch {
      setErrorMsg('Error inesperado al conectar con el servidor.')
      setFlowState('error')
    }
  }

  const handleCommit = async () => {
    if (!analysis) return
    setFlowState('committing')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/bulk-sync/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysis),
      })
      const data: CommitApiResponse = await res.json()

      if (!data.ok) {
        setErrorMsg(data.error ?? 'Error durante la actualización.')
        setFlowState('error')
        return
      }

      setCommitResult(data)
      setFlowState('done')
      window.dispatchEvent(new Event('bulk-sync-completed'))
    } catch {
      setErrorMsg('Error inesperado al conectar con el servidor.')
      setFlowState('error')
    }
  }

  const handleReset = () => {
    setDpFile(null)
    setCaFile(null)
    setAnalysis(null)
    setCommitResult(null)
    setErrorMsg(null)
    setFlowState('idle')
  }

  const dp = analysis?.datosPersonales
  const ca = analysis?.carreraAdministrativa

  const labelFlow: Record<FlowState, string> = {
    idle: 'Esperando archivos',
    ready: 'Archivos seleccionados',
    analyzing: 'Analizando...',
    preview: 'Previsualización lista',
    committing: 'Actualizando datos...',
    done: 'Actualización finalizada',
    error: 'Error',
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
        <RefreshCw className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">Actualización de datos desde Excel</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Cargá{' '}
            <span className="font-mono font-semibold">DatosPersonales.xlsx</span> y{' '}
            <span className="font-mono font-semibold">CarreraAdministrativa.xlsx</span>{' '}
            exportados desde VISMA para sincronizar la base de datos.
          </p>
        </div>
        {/* Estado del flujo */}
        <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-1 rounded-full shrink-0">
          {labelFlow[flowState]}
        </span>
      </div>

      {/* ── Carga de archivos ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest">
            Archivos Excel
          </h3>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Datos Personales</p>
            <FileDropZone
              label="DatosPersonales.xlsx"
              file={dpFile}
              onFile={handleDpFile}
              disabled={isLocked}
            />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-500 mb-1.5">Carrera Administrativa</p>
            <FileDropZone
              label="CarreraAdministrativa.xlsx"
              file={caFile}
              onFile={handleCaFile}
              disabled={isLocked}
            />
          </div>
        </div>
      </div>

      {/* ── Error global ── */}
      {errorMsg && (
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
          <span className="text-sm text-red-700 flex-1">{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── PREVISUALIZACIÓN ── */}
      {analysis && (flowState === 'preview' || flowState === 'committing') && dp && ca && (
        <div className="flex flex-col gap-4">
          {/* Advertencia si hay errores */}
          {analysis.tieneErroresCriticos && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-300 rounded-lg">
              <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-700">El archivo contiene errores</p>
                <p className="text-xs text-red-600 mt-0.5">
                  Hay {dp.errores.length + ca.errores.length} error(es) crítico(s). Corregí los archivos y volvé a analizar.
                  No se puede confirmar la actualización mientras haya errores.
                </p>
              </div>
            </div>
          )}

          {/* ── Datos Personales preview ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest flex-1">
                Datos Personales
              </h3>
            </div>
            <div className="p-4 flex flex-col gap-4">
              {/* Contadores */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-emerald-700">{dp.nuevas.length}</span>
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">Nuevos</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-blue-700">{dp.actualizadas.length}</span>
                  <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mt-0.5">A actualizar</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-slate-600">{dp.sinCambios}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Sin cambios</span>
                </div>
                <div className={`flex flex-col items-center justify-center rounded-lg py-2 px-1 border ${dp.errores.length > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xl font-bold ${dp.errores.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{dp.errores.length}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${dp.errores.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>Errores</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-amber-700">{dp.omitidas}</span>
                  <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">Omitidas</span>
                </div>
              </div>

              {/* Nuevos */}
              {dp.nuevas.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Agentes nuevos ({dp.nuevas.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {dp.nuevas.map((a) => (
                      <div key={a.dni} className="px-3 py-2 hover:bg-slate-50 transition">
                        <div className="flex items-center gap-2">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-mono text-slate-600">{a.dni}</span>
                          <span className="text-xs text-slate-400">—</span>
                          <span className="text-xs font-semibold text-slate-700">{a.apellido} {a.nombre}</span>
                          {a.cargo && <span className="text-xs text-slate-400 ml-auto">{a.cargo}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* A actualizar */}
              {dp.actualizadas.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> A actualizar ({dp.actualizadas.length})
                  </p>
                  <DiffListDP items={dp.actualizadas} />
                </div>
              )}

              {/* Errores DP */}
              {dp.errores.length > 0 && <ErrorList errors={dp.errores} />}
            </div>
          </div>

          {/* ── Carrera Administrativa preview ── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
              <Database className="w-4 h-4 text-violet-600" />
              <h3 className="text-xs font-bold text-violet-700 uppercase tracking-widest flex-1">
                Carrera Administrativa
              </h3>
            </div>
            <div className="p-4 flex flex-col gap-4">
              {/* Contadores */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-emerald-700">{ca.nuevas.length}</span>
                  <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">Nuevas</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-blue-700">{ca.actualizadas.length}</span>
                  <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mt-0.5">A actualizar</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-slate-600">{ca.sinCambios}</span>
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Sin cambios</span>
                </div>
                <div className={`flex flex-col items-center justify-center rounded-lg py-2 px-1 border ${ca.errores.length > 0 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                  <span className={`text-xl font-bold ${ca.errores.length > 0 ? 'text-red-600' : 'text-slate-400'}`}>{ca.errores.length}</span>
                  <span className={`text-[10px] font-semibold uppercase tracking-wider mt-0.5 ${ca.errores.length > 0 ? 'text-red-500' : 'text-slate-400'}`}>Errores</span>
                </div>
                <div className="flex flex-col items-center justify-center bg-amber-50 border border-amber-200 rounded-lg py-2 px-1">
                  <span className="text-xl font-bold text-amber-700">{ca.ignoradas}</span>
                  <span className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mt-0.5">Altas ignoradas</span>
                </div>
              </div>

              {/* Fases nuevas */}
              {ca.nuevas.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Fases nuevas ({ca.nuevas.length})
                  </p>
                  <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                    {ca.nuevas.map((c, i) => (
                      <div key={`${c.dni}-${i}`} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition text-xs">
                        <span className="font-mono text-slate-600">{c.dni}</span>
                        <span className="text-slate-400">alta: {c.fechaAltaStr}</span>
                        {c.fechaBajaStr && <span className="text-slate-400">baja: {c.fechaBajaStr}</span>}
                        {c.causaBaja && <span className="text-slate-400 ml-auto">{c.causaBaja}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fases a actualizar */}
              {ca.actualizadas.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" /> A actualizar ({ca.actualizadas.length})
                  </p>
                  <DiffListCA items={ca.actualizadas} />
                </div>
              )}

              {/* Errores CA */}
              {ca.errores.length > 0 && <ErrorList errors={ca.errores} />}
              <WarningList items={dp.sinDni} title="personas sin DNI" />
              <WarningList items={ca.noEncontradas} title="fases no encontradas" />
            </div>
          </div>
        </div>
      )}

      {/* ── RESULTADO FINAL ── */}
      {flowState === 'done' && commitResult && (
        <div className="bg-white rounded-xl border border-emerald-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <h3 className="text-sm font-bold text-emerald-700 flex-1">Actualización completada</h3>
            {commitResult.lastUpdated && (
              <span className="text-xs text-emerald-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> {commitResult.lastUpdated}
              </span>
            )}
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {commitResult.datosPersonales && (
              <div>
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Datos Personales
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Nuevos insertados</span><span className="font-bold text-emerald-600">{commitResult.datosPersonales.insertados}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Actualizados</span><span className="font-bold text-blue-600">{commitResult.datosPersonales.actualizados}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sin cambios</span><span className="text-slate-400">{commitResult.datosPersonales.sinCambios}</span></div>
                </div>
              </div>
            )}
            {commitResult.carreraAdministrativa && (
              <div>
                <p className="text-xs font-bold text-violet-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" /> Carrera Administrativa
                </p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between"><span className="text-slate-500">Fases nuevas</span><span className="font-bold text-emerald-600">{commitResult.carreraAdministrativa.insertadas}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Fases actualizadas</span><span className="font-bold text-blue-600">{commitResult.carreraAdministrativa.actualizadas}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">Sin cambios</span><span className="text-slate-400">{commitResult.carreraAdministrativa.sinCambios}</span></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Acciones ── */}
      <div className="flex items-center gap-3 justify-between flex-wrap">
        {flowState === 'done' && (
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
          >
            <RefreshCw className="w-4 h-4" />
            Nueva importación
          </button>
        )}

        <div className="ml-auto flex items-center gap-3">
          {/* Botón Analizar */}
          {(flowState === 'idle' || flowState === 'ready' || flowState === 'error') && (
            <button
              onClick={handleAnalyze}
              disabled={!canAnalyze}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm"
            >
              <Search className="w-4 h-4" /> Analizar archivos
            </button>
          )}

          {/* Botón Analizar de nuevo (en preview) */}
          {flowState === 'preview' && (
            <button
              onClick={handleAnalyze}
              disabled={isLocked}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
            >
              <RefreshCw className="w-4 h-4" />
              Re-analizar
            </button>
          )}

          {/* Botón Confirmar */}
          {flowState === 'preview' && !analysis?.tieneErroresCriticos && (
            <button
              onClick={handleCommit}
              disabled={isLocked}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Confirmar actualización
            </button>
          )}

          {/* Estado procesando */}
          {flowState === 'analyzing' && (
            <button disabled className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1e3a8a] opacity-60 cursor-not-allowed text-white text-sm font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" /> Analizando...
            </button>
          )}
          {flowState === 'committing' && (
            <button disabled className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 opacity-60 cursor-not-allowed text-white text-sm font-semibold">
              <Loader2 className="w-4 h-4 animate-spin" /> Actualizando...
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main OperacionesPanel ─────────────────────────────────────────────────────
export default function OperacionesPanel({ activeOp, onChangeOp }: OperacionesPanelProps) {
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-[#1e3a8a] mb-1">Operaciones</h1>
      <p className="text-sm text-slate-500 mb-6">Seleccione una operación para continuar.</p>

      {/* Op selector tabs */}
      <div className="flex gap-2 mb-6 border-b border-slate-200 pb-0">
        <button
          onClick={() => onChangeOp('agregar-agente')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition -mb-px ${
            activeOp === 'agregar-agente'
              ? 'bg-white border-slate-200 text-[#1e3a8a] shadow-sm'
              : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
          }`}
        >
          <UserCog className="w-4 h-4" />
          Gestión de Agentes
        </button>
        <button
          onClick={() => onChangeOp('actualizacion-masiva')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-t-lg border border-b-0 transition -mb-px ${
            activeOp === 'actualizacion-masiva'
              ? 'bg-white border-slate-200 text-[#1e3a8a] shadow-sm'
              : 'bg-slate-100 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-200'
          }`}
        >
          <RefreshCw className="w-4 h-4" />
          Actualización Masiva
        </button>
      </div>

      {/* Content */}
      {activeOp === 'agregar-agente' && <GestionAgentes />}
      {activeOp === 'actualizacion-masiva' && <ActualizacionMasiva />}
      {!activeOp && (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Search className="w-10 h-10 opacity-30" />
          <p className="text-sm">Seleccione una operación de las pestañas de arriba.</p>
        </div>
      )}
    </div>
  )
}
