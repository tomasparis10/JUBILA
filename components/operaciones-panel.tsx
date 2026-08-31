'use client'

import { useState } from 'react'
import {
  PlusCircle, RefreshCw, UserCheck, AlertCircle, CheckCircle2,
  Loader2, Clock, Users, X, UserCircle, Save, Search, ArrowRight,
  FileText, Database,
} from 'lucide-react'
import { createAgente } from '@/app/actions/agentes'
import { FormField } from '@/components/form-field'
import { formatCuil, extractDniFromCuil } from '@/lib/format-utils'
import type { JubilacionRecord } from '@/lib/jubilaciones-data'

type OpMode = 'agregar-agente' | 'actualizacion-masiva'

interface OperacionesPanelProps {
  activeOp: OpMode | null
  onChangeOp: (op: OpMode) => void
}

// ── Tipos del resultado de la API ─────────────────────────────────────────────
interface DiffField { campo: string; anterior: string; nuevo: string }
interface AgenteNuevo { dni: string; nombre: string; apellido: string; secretaria: string; programa: string; cargo: string; sexo: string; estadoActivo: boolean; cuil: string; telefono: string; correo: string; fechaNacimiento: string }
interface AgenteActualizado { dni: string; nombre: string; diffs: DiffField[] }
interface CarreraNueva { dni: string; fechaAlta: string; fechaBaja: string; causaBaja: string }
interface CarreraActualizada { dni: string; fechaAlta: string; diffs: DiffField[] }

interface BulkSyncResult {
  ok: boolean
  lastUpdated: string
  datosPersonales: {
    nuevos: AgenteNuevo[]
    actualizados: AgenteActualizado[]
    sinCambios: number
    errores: number
    errorDetails: string[]
  }
  carreraAdministrativa: {
    nuevas: CarreraNueva[]
    actualizadas: CarreraActualizada[]
    sinCambios: number
    errores: number
    errorDetails: string[]
  }
  error?: string
}

// ── Formulario de Nuevo Agente (embebido) ────────────────────────────────────
function FormNuevoAgente() {
  const emptyAgent = (): Partial<JubilacionRecord> => ({
    cuil: '', dni: '', apellidoNombres: '', telefono: '',
    correo: '', fechaNacimiento: '', edadActual: '',
  })

  const [form, setForm] = useState<Partial<JubilacionRecord>>(emptyAgent())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const update = (field: keyof JubilacionRecord, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleCuilChange = (raw: string) => {
    const cuil = formatCuil(raw)
    const dni = extractDniFromCuil(raw)
    setForm((prev) => ({ ...prev, cuil, dni }))
  }

  const handleFechaNac = (v: string) => {
    update('fechaNacimiento', v)
    if (v.length === 10) {
      const parts = v.split('/')
      if (parts.length === 3) {
        const [dd, mm, yyyy] = parts
        const d = new Date(`${yyyy}-${mm}-${dd}`)
        if (!isNaN(d.getTime())) {
          const hoy = new Date()
          let edad = hoy.getFullYear() - d.getFullYear()
          const m = hoy.getMonth() - d.getMonth()
          if (m < 0 || (m === 0 && hoy.getDate() < d.getDate())) edad--
          update('edadActual', String(edad))
        }
      }
    }
  }

  const handleReset = () => {
    setForm(emptyAgent())
    setError(null)
    setSuccess(false)
  }

  const handleSave = async () => {
    setError(null)
    if (!form.dni) { setError('El DNI (derivado del CUIL) es obligatorio.'); return }
    if (!form.apellidoNombres) { setError('El Apellido y Nombres son obligatorios.'); return }
    setSaving(true)
    try {
      const result = await createAgente(form)
      if (result.ok) {
        const now = new Date()
        const ts = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
        setLastUpdated(ts)
        setSuccess(true)
        setForm(emptyAgent())
      } else {
        setError(result.error ?? 'Error al guardar.')
      }
    } catch {
      setError('Error inesperado al guardar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
        <UserCircle className="w-5 h-5 text-[#1e3a8a] mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-[#1e3a8a]">Agregar Nuevo Agente</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete los datos personales del nuevo agente. El estado se establecerá como{' '}
            <span className="font-semibold text-emerald-600">ACTIVO</span> por defecto.
          </p>
        </div>
      </div>

      {/* Success banner */}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-700">¡Agente registrado con éxito!</p>
            {lastUpdated && (
              <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5">
                <Clock className="w-3 h-3" /> Última actualización: {lastUpdated}
              </p>
            )}
          </div>
          <button onClick={handleReset} className="text-emerald-500 hover:text-emerald-700 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Form */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200">
          <h3 className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest">Datos Personales</h3>
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
            label="DNI (automático)"
            value={form.dni ?? ''}
            placeholder="Número de DNI"
            readOnly
          />
          <FormField
            label="Apellido y Nombres"
            value={form.apellidoNombres ?? ''}
            onChange={(v) => update('apellidoNombres', v)}
            placeholder="Apellido y Nombres"
            className="col-span-2"
            mask="letters"
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
            onChange={handleFechaNac}
            placeholder="dd/mm/aaaa"
            mask="date"
          />
          <FormField
            label="Edad Actual"
            value={form.edadActual ?? ''}
            placeholder="Auto"
            readOnly
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end">
        {lastUpdated && !success && (
          <span className="text-xs text-slate-400 flex items-center gap-1 mr-auto">
            <Clock className="w-3 h-3" /> Última actualización: {lastUpdated}
          </span>
        )}
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-sm font-semibold transition"
        >
          Limpiar
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Guardando...' : 'Guardar Agente'}
        </button>
      </div>
    </div>
  )
}

// ── Panel Actualización Masiva ────────────────────────────────────────────────
function ActualizacionMasiva() {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<BulkSyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch('/api/bulk-sync', { method: 'POST' })
      const data: BulkSyncResult = await res.json()
      if (data.ok) {
        setResult(data)
      } else {
        setError(data.error ?? 'Error durante la actualización masiva.')
      }
    } catch {
      setError('Error inesperado al conectar con la API.')
    } finally {
      setRunning(false)
    }
  }

  const dp = result?.datosPersonales
  const ca = result?.carreraAdministrativa

  return (
    <div className="flex flex-col gap-5">
      {/* Header info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
        <RefreshCw className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Actualización Masiva desde Excel</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Lee <span className="font-mono font-semibold">DatosPersonales.xlsx</span> y{' '}
            <span className="font-mono font-semibold">CarreraAdministrativa.xlsx</span> desde{' '}
            <span className="font-mono">data/</span> y sincroniza la base de datos campo a campo.
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-sm text-red-700 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="flex flex-col gap-4">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3 h-3" /> Última actualización: {result.lastUpdated}
          </div>

          {/* ── Sección Datos Personales ── */}
          {dp && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-blue-50 border-b border-blue-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-blue-700 uppercase tracking-widest flex-1">Datos Personales</h3>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {/* Contadores */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-emerald-700">{dp.nuevos.length}</span>
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">Nuevos</span>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-blue-700">{dp.actualizados.length}</span>
                    <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mt-0.5">Actualizados</span>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-slate-600">{dp.sinCambios}</span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Sin cambios</span>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-red-600">{dp.errores}</span>
                    <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mt-0.5">Errores</span>
                  </div>
                </div>

                {/* Nuevos */}
                {dp.nuevos.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" /> Agentes nuevos ({dp.nuevos.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {dp.nuevos.map((a) => (
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

                {/* Actualizados */}
                {dp.actualizados.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Actualizados ({dp.actualizados.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {dp.actualizados.map((a) => (
                        <div key={a.dni} className="px-3 py-2 hover:bg-slate-50 transition">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-slate-600">{a.dni}</span>
                            <span className="text-xs text-slate-400">—</span>
                            <span className="text-xs font-semibold text-slate-700">{a.nombre}</span>
                          </div>
                          {a.diffs.map((d) => (
                            <div key={d.campo} className="flex items-center gap-1.5 pl-4 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-400 w-32 shrink-0">{d.campo}</span>
                              <span className="text-[10px] text-red-500 line-through">{d.anterior || '—'}</span>
                              <ArrowRight className="w-3 h-3 text-slate-300 shrink-0" />
                              <span className="text-[10px] text-emerald-600 font-semibold">{d.nuevo || '—'}</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Errores */}
                {dp.errorDetails.length > 0 && (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-2 max-h-24 overflow-y-auto">
                    {dp.errorDetails.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Sección Carrera Administrativa ── */}
          {ca && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-violet-50 border-b border-violet-200 flex items-center gap-2">
                <Database className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold text-violet-700 uppercase tracking-widest flex-1">Carrera Administrativa</h3>
              </div>
              <div className="p-4 flex flex-col gap-4">
                {/* Contadores */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-emerald-700">{ca.nuevas.length}</span>
                    <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-0.5">Nuevas</span>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-blue-50 border border-blue-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-blue-700">{ca.actualizadas.length}</span>
                    <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider mt-0.5">Actualizadas</span>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-slate-600">{ca.sinCambios}</span>
                    <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-0.5">Sin cambios</span>
                  </div>
                  <div className="flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-lg py-2 px-1">
                    <span className="text-xl font-bold text-red-600">{ca.errores}</span>
                    <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mt-0.5">Errores</span>
                  </div>
                </div>

                {/* Nuevas */}
                {ca.nuevas.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Entradas nuevas ({ca.nuevas.length})
                    </p>
                    <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {ca.nuevas.map((c, i) => (
                        <div key={`${c.dni}-${i}`} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition text-xs">
                          <span className="font-mono text-slate-600">{c.dni}</span>
                          <span className="text-slate-400">alta: {c.fechaAlta}</span>
                          {c.fechaBaja && <span className="text-slate-400">baja: {c.fechaBaja}</span>}
                          {c.causaBaja && <span className="text-slate-400 ml-auto">{c.causaBaja}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actualizadas */}
                {ca.actualizadas.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Actualizadas ({ca.actualizadas.length})
                    </p>
                    <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                      {ca.actualizadas.map((c, i) => (
                        <div key={`${c.dni}-${i}`} className="px-3 py-2 hover:bg-slate-50 transition">
                          <div className="flex items-center gap-2 mb-1 text-xs">
                            <span className="font-mono text-slate-600">{c.dni}</span>
                            <span className="text-slate-400">alta: {c.fechaAlta}</span>
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
                  </div>
                )}

                {/* Errores */}
                {ca.errorDetails.length > 0 && (
                  <div className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg p-2 max-h-24 overflow-y-auto">
                    {ca.errorDetails.map((e, i) => <p key={i}>{e}</p>)}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Botón */}
      <div className="flex items-center gap-3 justify-between">
        {result?.lastUpdated && (
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Última actualización: {result.lastUpdated}
          </span>
        )}
        <button
          onClick={handleSync}
          disabled={running}
          className="ml-auto flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold transition shadow-sm"
        >
          {running
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando Excel...</>
            : <><RefreshCw className="w-4 h-4" /> Actualizar desde Excel</>
          }
        </button>
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
          <PlusCircle className="w-4 h-4" />
          Agregar Nuevo Agente
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
      {activeOp === 'agregar-agente' && <FormNuevoAgente />}
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
