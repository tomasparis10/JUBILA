'use client'

import { useState } from 'react'
import {
  PlusCircle, RefreshCw, UserCheck, AlertCircle, CheckCircle2,
  Loader2, Clock, Users, X, UserCircle, Save, Search,
} from 'lucide-react'
import { bulkSyncAgentes, createAgente } from '@/app/actions/agentes'
import { FormField } from '@/components/form-field'
import { formatCuil, extractDniFromCuil } from '@/lib/format-utils'
import type { JubilacionRecord } from '@/lib/jubilaciones-data'

type OpMode = 'agregar-agente' | 'actualizacion-masiva'

interface OperacionesPanelProps {
  activeOp: OpMode | null
  onChangeOp: (op: OpMode) => void
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
  const [result, setResult] = useState<{
    added: number; skipped: number; errors: number;
    lastUpdated: string; newAgents: { dni: string; nombre: string }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSync = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await bulkSyncAgentes()
      if (res.ok) {
        setResult({
          added: res.added,
          skipped: res.skipped,
          errors: res.errors,
          lastUpdated: res.lastUpdated,
          newAgents: res.newAgents,
        })
      } else {
        setError(res.error ?? 'Error durante la sincronización.')
      }
    } catch {
      setError('Error inesperado durante la sincronización.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
        <RefreshCw className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-800">Actualización Masiva de Agentes</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Busca en la tabla{' '}
            <span className="font-mono font-semibold">CARRERA_ADMINISTRATIVA</span> todos los empleados
            que no estén registrados en el sistema y los agrega con su carrera administrativa.
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

      {/* Result card */}
      {result && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-emerald-700 uppercase tracking-widest">
              Resultado de la Sincronización
            </h3>
            <span className="ml-auto text-xs text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {result.lastUpdated}
            </span>
          </div>
          <div className="p-4">
            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="flex flex-col items-center justify-center bg-emerald-50 border border-emerald-200 rounded-lg py-3 px-2">
                <span className="text-2xl font-bold text-emerald-700">{result.added}</span>
                <span className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mt-1">Agregados</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-lg py-3 px-2">
                <span className="text-2xl font-bold text-slate-600">{result.skipped}</span>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mt-1">Ya existían</span>
              </div>
              <div className="flex flex-col items-center justify-center bg-red-50 border border-red-200 rounded-lg py-3 px-2">
                <span className="text-2xl font-bold text-red-600">{result.errors}</span>
                <span className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mt-1">Errores</span>
              </div>
            </div>

            {/* New agents list */}
            {result.newAgents.length > 0 ? (
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Agentes añadidos ({result.newAgents.length})
                </p>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {result.newAgents.map((a) => (
                    <div key={a.dni} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 transition">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="text-xs font-mono text-slate-600">{a.dni}</span>
                      <span className="text-xs text-slate-400">—</span>
                      <span className="text-xs text-slate-700">{a.nombre}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-3">
                ✓ No se encontraron empleados nuevos para agregar.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action button */}
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
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</>
            : <><RefreshCw className="w-4 h-4" /> Sincronizar desde Base</>
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
