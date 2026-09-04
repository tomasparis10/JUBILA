'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, AlertTriangle, Loader2, UserCircle, FileDown, CheckSquare } from 'lucide-react'
import { getAgentesProxJubilacion, getAgentesData, type AgenteProxJubilacion } from '@/app/actions/agentes'

interface ProxJubilacionesWidgetProps {
  onAgenteClick: (dni: string) => void
}

export default function ProxJubilacionesWidget({ onAgenteClick }: ProxJubilacionesWidgetProps) {
  const [agentes, setAgentes] = useState<AgenteProxJubilacion[]>([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const loadAgentes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getAgentesProxJubilacion()
      setAgentes(data)
      setChecked(new Set())
    } catch {
      setAgentes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAgentes()
    const handleBulkSyncCompleted = () => { void loadAgentes() }
    window.addEventListener('bulk-sync-completed', handleBulkSyncCompleted)
    return () => window.removeEventListener('bulk-sync-completed', handleBulkSyncCompleted)
  }, [loadAgentes])

  const toggleCheck = (dni: string) => {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(dni)) {
        next.delete(dni)
      } else {
        next.add(dni)
      }
      return next
    })
  }

  const toggleAll = () => {
    if (checked.size === agentes.length) {
      setChecked(new Set())
    } else {
      setChecked(new Set(agentes.map((a) => a.dni)))
    }
  }

  const handleExport = async () => {
    if (checked.size === 0) return
    setExporting(true)
    try {
      const dnis = Array.from(checked)
      const data = await getAgentesData(dnis)

      // Importar xlsx dinámicamente (sólo en cliente)
      const XLSX = await import('xlsx')

      const rows = data.map((ag) => ({
        'DNI': ag.dni,
        'CUIL': ag.cuil,
        'Apellido y Nombres': ag.apellidoNombres,
        'Fecha de Nacimiento': ag.fechaNacimiento,
        'Fecha Est. Jubilación': ag.fechaEstimada,
        'Secretaría': ag.secretaria,
        'Programa': ag.programa,
        'Cargo': ag.cargo,
        'Antigüedad Recibo': ag.antiguedadRecibo,
        'Antigüedad Licencias': ag.antiguedadLicencias,
      }))

      const ws = XLSX.utils.json_to_sheet(rows)

      // Ajustar ancho de columnas automáticamente
      const colWidths = Object.keys(rows[0] ?? {}).map((key) => ({
        wch: Math.max(key.length, ...rows.map((r) => String((r as any)[key] ?? '').length)) + 2,
      }))
      ws['!cols'] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Jubilaciones')

      const now = new Date()
      const fecha = `${String(now.getDate()).padStart(2, '0')}${String(now.getMonth() + 1).padStart(2, '0')}${now.getFullYear()}`
      XLSX.writeFile(wb, `proximas_jubilaciones_${fecha}.xlsx`)
    } catch (err) {
      console.error('[ProxJubilacionesWidget] Error al exportar:', err)
    } finally {
      setExporting(false)
    }
  }

  const allChecked = agentes.length > 0 && checked.size === agentes.length
  const someChecked = checked.size > 0 && checked.size < agentes.length

  return (
    <div className="mx-3 mb-4 rounded-xl border border-[#1e3a8a]/60 bg-[#0f1f4a]/80 overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#1e3a8a]/60 bg-[#172554]/90">
        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/30 flex-shrink-0">
          <Clock className="w-3 h-3 text-amber-400" />
        </div>
        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-widest leading-tight flex-1">
          Próx. a Jubilar
        </span>
        {agentes.length > 0 && (
          <>
            {/* Checkbox seleccionar todos */}
            <button
              onClick={toggleAll}
              title={allChecked ? 'Desmarcar todos' : 'Seleccionar todos'}
              className="flex items-center justify-center w-5 h-5 rounded hover:bg-[#1e3a8a]/60 transition-colors flex-shrink-0"
            >
              <CheckSquare
                className={`w-3 h-3 transition-colors ${
                  allChecked
                    ? 'text-amber-400'
                    : someChecked
                    ? 'text-amber-400/60'
                    : 'text-slate-500'
                }`}
              />
            </button>
            <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-[9px] font-black text-[#172554] flex-shrink-0">
              {agentes.length}
            </span>
          </>
        )}
      </div>

      {/* Body */}
      <div className="max-h-64 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-5 px-3">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
            <span className="text-[10px] text-blue-400">Cargando...</span>
          </div>
        ) : agentes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-5 px-3">
            <AlertTriangle className="w-5 h-5 text-slate-500" />
            <p className="text-[9px] text-slate-500 text-center leading-relaxed">
              Sin agentes en condiciones<br />de jubilarse este mes
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#1e3a8a]/30">
            {agentes.map((ag) => (
              <li key={ag.dni} className="flex items-start gap-1.5 px-2 py-2 hover:bg-[#1e3a8a]/40 transition-colors group">
                {/* Checkbox */}
                <label
                  className="flex items-center justify-center w-5 h-5 flex-shrink-0 mt-0.5 cursor-pointer"
                  title="Seleccionar para exportar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={checked.has(ag.dni)}
                    onChange={() => toggleCheck(ag.dni)}
                    className="w-3 h-3 accent-amber-400 cursor-pointer rounded"
                  />
                </label>

                {/* Info del agente — clic carga la ficha */}
                <button
                  onClick={() => onAgenteClick(ag.dni)}
                  className="flex-1 text-left min-w-0"
                >
                  <div className="flex items-start gap-1.5">
                    <UserCircle className="w-3.5 h-3.5 text-blue-400/60 flex-shrink-0 mt-0.5 group-hover:text-blue-300 transition-colors" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-slate-200 truncate group-hover:text-white transition-colors leading-tight">
                        {ag.apellidoNombres}
                      </p>
                      <p className="text-[9px] text-blue-400/80 font-mono mt-0.5">
                        DNI {ag.dni}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Clock className="w-2.5 h-2.5 text-amber-400/70" />
                        <p className="text-[9px] text-amber-300/90 font-semibold">
                          {ag.fechaEstimada}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Footer: botón exportar (solo si hay agentes seleccionados) */}
      {checked.size > 0 && (
        <div className="px-3 py-2 border-t border-[#1e3a8a]/60 bg-[#172554]/80">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-[10px] font-bold uppercase tracking-wider transition-colors shadow-sm"
          >
            {exporting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <FileDown className="w-3 h-3" />
            )}
            {exporting
              ? 'Exportando...'
              : `Exportar Excel (${checked.size})`}
          </button>
        </div>
      )}
    </div>
  )
}
