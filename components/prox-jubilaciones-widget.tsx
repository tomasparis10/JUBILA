'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, UserCircle, FileDown, CheckSquare, CalendarClock } from 'lucide-react'
import { getAgentesProxJubilacion, getAgentesData, type AgenteProxJubilacion } from '@/app/actions/agentes'

interface ProxJubilacionesPanelProps {
  onAgenteClick: (dni: string) => void
}

export default function ProxJubilacionesPanel({ onAgenteClick }: ProxJubilacionesPanelProps) {
  const [agentes, setAgentes] = useState<AgenteProxJubilacion[]>([])
  const [loading, setLoading] = useState(true)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [draftRange, setDraftRange] = useState({ from: '', to: '' })
  const [appliedRange, setAppliedRange] = useState({ from: '', to: '' })

  const loadAgentes = useCallback(async (from?: string, to?: string) => {
    setLoading(true)
    try {
      const data = await getAgentesProxJubilacion(from, to)
      setAgentes(data)
      setChecked(new Set())
    } catch {
      setAgentes([])
    } finally {
      setLoading(false)
    }
  }, [])

  const applyDateRange = () => {
    if (!draftRange.from || !draftRange.to) return
    setAppliedRange(draftRange)
    void loadAgentes(draftRange.from, draftRange.to)
  }

  const clearDateRange = () => {
    setDraftRange({ from: '', to: '' })
    setAppliedRange({ from: '', to: '' })
    void loadAgentes()
  }

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
        'Régimen': ag.regimen,
        'Antigüedad Actual': ag.antiguedadRecibo,
        'Edad Actual': ag.edadActual,
        'Fecha Est. Jubilación': ag.fechaEstimada,
        'Estado Edad Avanzada': ag.noCumpleAportesEdadAvanzada
          ? 'No puede jubilarse: no supera 10 años de aportes al cumplir 70 años'
          : '',
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
      console.error('[ProxJubilacionesPanel] Error al exportar:', err)
    } finally {
      setExporting(false)
    }
  }

  const allChecked = agentes.length > 0 && checked.size === agentes.length
  const someChecked = checked.size > 0 && checked.size < agentes.length

  return (
    <div className="flex flex-col gap-5">
      {/* Header info */}
      <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
        <CalendarClock className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-amber-800">Próximos a Jubilar</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {appliedRange.from && appliedRange.to
              ? 'Agentes activos cuya fecha estimada de jubilación cae en el rango seleccionado.'
              : 'Agentes activos cuya fecha estimada de jubilación cae en el rango de ±30 días respecto de hoy.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-sm">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Fecha desde
          <input
            type="date"
            value={draftRange.from}
            max={draftRange.to || undefined}
            onChange={(event) => setDraftRange((range) => ({ ...range, from: event.target.value }))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Fecha hasta
          <input
            type="date"
            value={draftRange.to}
            min={draftRange.from || undefined}
            onChange={(event) => setDraftRange((range) => ({ ...range, to: event.target.value }))}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </label>
        <button
          type="button"
          onClick={applyDateRange}
          disabled={!draftRange.from || !draftRange.to || loading}
          className="h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition"
        >
          Filtrar
        </button>
        <button
          type="button"
          onClick={clearDateRange}
          disabled={(!draftRange.from && !draftRange.to && !appliedRange.from) || loading}
          className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-slate-700 text-xs font-bold transition"
        >
          Limpiar
        </button>
      </div>

      {/* ── Lista / tabla ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
          <UserCircle className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest flex-1">
            {loading ? 'Cargando...' : `${agentes.length} agente${agentes.length !== 1 ? 's' : ''} en el rango seleccionado`}
          </span>
          {agentes.length > 0 && (
            <>
              <button
                onClick={toggleAll}
                title={allChecked ? 'Desmarcar todos' : 'Seleccionar todos'}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-[#1e3a8a] text-[10px] font-semibold transition flex-shrink-0"
              >
                <CheckSquare
                  className={`w-3 h-3 transition-colors ${
                    allChecked
                      ? 'text-emerald-600'
                      : someChecked
                      ? 'text-emerald-500/70'
                      : 'text-slate-400'
                  }`}
                />
                {allChecked ? 'Desmarcar todos' : 'Seleccionar todos'}
              </button>
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-400 text-[10px] font-black text-[#172554] flex-shrink-0">
                {agentes.length}
              </span>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16">
            <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
            <span className="text-sm text-blue-400">Cargando agentes...</span>
          </div>
        ) : agentes.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
            <AlertTriangle className="w-8 h-8 opacity-30" />
            <p className="text-sm">Sin agentes en condiciones de jubilarse en este rango de fechas.</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10">
                <tr>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-600 uppercase tracking-wider w-10">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={toggleAll}
                      className="w-3.5 h-3.5 accent-amber-400 cursor-pointer rounded"
                    />
                  </th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider w-24">DNI</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider">Apellido y Nombres</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider">Régimen</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-600 uppercase tracking-wider w-32">Antigüedad Actual</th>
                  <th className="px-3 py-2.5 text-center font-bold text-slate-600 uppercase tracking-wider w-20">Edad Actual</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider w-28">Fecha Est. Jubil.</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider hidden md:table-cell">Programa</th>
                  <th className="px-3 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Cargo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {agentes.map((ag) => {
                  const isChecked = checked.has(ag.dni)
                  const isIneligible = ag.noCumpleAportesEdadAvanzada
                  return (
                    <tr
                      key={ag.dni}
                      onClick={() => toggleCheck(ag.dni)}
                      className={`cursor-pointer transition ${
                        isIneligible
                          ? 'bg-red-50 hover:bg-red-100/80'
                          : isChecked ? 'bg-amber-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCheck(ag.dni)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-3.5 h-3.5 accent-amber-400 cursor-pointer rounded"
                        />
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{ag.dni || '—'}</td>
                      <td className="px-3 py-2.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); onAgenteClick(ag.dni) }}
                          className="font-semibold text-slate-800 hover:text-[#1e3a8a] hover:underline text-left"
                        >
                          {ag.apellidoNombres || '—'}
                        </button>
                        {isIneligible && (
                          <span className="flex items-center gap-1 mt-1 text-[10px] font-bold text-red-700">
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            No puede jubilarse: no supera 10 años de aportes al cumplir 70 años
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-slate-600">{ag.regimen || '—'}</td>
                      <td className={`px-3 py-2.5 text-center font-semibold ${isIneligible ? 'text-red-700' : 'text-slate-700'}`}>{ag.antiguedadRecibo || '—'}</td>
                      <td className={`px-3 py-2.5 text-center font-semibold ${isIneligible ? 'text-red-700' : 'text-slate-700'}`}>{ag.edadActual || '—'}</td>
                      <td className="px-3 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border font-semibold ${
                          isIneligible
                            ? 'bg-red-100 border-red-300 text-red-700'
                            : 'bg-amber-50 border-amber-200 text-amber-700'
                        }`}>
                          {ag.fechaEstimada || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 hidden md:table-cell truncate max-w-[160px]">{ag.programa || '—'}</td>
                      <td className="px-3 py-2.5 text-slate-500 hidden lg:table-cell truncate max-w-[160px]">{ag.cargo || '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Botón exportar ── */}
      {checked.size > 0 && (
        <div className="flex items-center justify-end">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-bold uppercase tracking-wider transition shadow-sm"
          >
            {exporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
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
