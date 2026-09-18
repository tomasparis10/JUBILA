'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, BellRing, Loader2, RefreshCw, CalendarClock, UserCircle } from 'lucide-react'
import { getAlertasInvalidezProvisoria, type AlertaInvalidezProvisoria } from '@/app/actions/alertas'

export default function AlertasPanel() {
  const [alertas, setAlertas] = useState<AlertaInvalidezProvisoria[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadAlertas = useCallback(async (silencioso = false) => {
    if (silencioso) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    try {
      const data = await getAlertasInvalidezProvisoria()
      setAlertas(data)
    } catch {
      setAlertas([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    void loadAlertas()
    const handleBulkSyncCompleted = () => { void loadAlertas(true) }
    window.addEventListener('bulk-sync-completed', handleBulkSyncCompleted)
    return () => window.removeEventListener('bulk-sync-completed', handleBulkSyncCompleted)
  }, [loadAlertas])

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#1e3a8a] mb-1">Alertas</h1>
      <p className="text-sm text-slate-500 mb-6">
        Vencimientos de invalidez provisoria dentro de los próximos 90 días.
      </p>

      <div className="flex flex-col gap-5">
        {/* Header info */}
        <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <BellRing className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">Alertas activas</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Agentes con causa de baja <span className="font-semibold text-slate-700">Jubilación por Invalidez Provisoria</span> cuyo
              último bloque de Otorgamiento y Renovación Provisoria vence dentro de 90 días (desde hoy hasta el {(() => {
                const d = new Date(Date.now() + 90 * 86400000)
                return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
              })()}).
            </p>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <UserCircle className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest flex-1">
              {loading
                ? 'Cargando...'
                : `${alertas.length} alerta${alertas.length !== 1 ? 's' : ''} activa${alertas.length !== 1 ? 's' : ''} en los próximos 90 días`}
            </span>
            <button
              type="button"
              onClick={() => void loadAlertas(true)}
              disabled={refreshing || loading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-[10px] font-semibold transition flex-shrink-0 disabled:opacity-50"
            >
              {refreshing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
              Actualizar
            </button>
            {alertas.length > 0 && (
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-600 text-white text-[11px] font-black flex-shrink-0">
                {alertas.length > 99 ? '99+' : alertas.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16">
              <Loader2 className="w-5 h-5 animate-spin text-red-400" />
              <span className="text-sm text-slate-400">Cargando alertas...</span>
            </div>
          ) : alertas.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-slate-400">
              <AlertTriangle className="w-8 h-8 opacity-30" />
              <p className="text-sm">No hay alertas activas. Las alertas se generan cuando a un agente con invalidez provisoria le falten 90 días o menos para el vencimiento del HASTA.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-100 z-10">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider w-28">Documento</th>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Nombre completo</th>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Cargo</th>
                    <th className="px-5 py-3 text-left font-bold text-slate-600 uppercase tracking-wider">Programa</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 uppercase tracking-wider w-28">Desde</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 uppercase tracking-wider w-28">Hasta</th>
                    <th className="px-5 py-3 text-center font-bold text-slate-600 uppercase tracking-wider w-24">Días restantes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alertas.map((a) => {
                    const urgente = a.diasRestantes <= 30
                    return (
                      <tr key={a.dni} className={`transition ${urgente ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-amber-50/60'}`}>
                        <td className="px-5 py-4 font-mono text-slate-700 whitespace-nowrap">{a.dni}</td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-slate-800">{a.nombreCompleto}</div>
                          {urgente && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-red-700">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              Vence en menos de 30 días
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-slate-600">{a.cargo || '—'}</td>
                        <td className="px-5 py-4 text-slate-600">{a.programa || '—'}</td>
                        <td className="px-5 py-4 text-center text-slate-600 whitespace-nowrap">{a.fechaDesde || '—'}</td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full border font-semibold ${
                            urgente
                              ? 'bg-red-100 border-red-300 text-red-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}>
                            <CalendarClock className="w-3 h-3 mr-1.5" />
                            {a.fechaHasta}
                          </span>
                        </td>
                        <td className={`px-5 py-4 text-center font-bold ${urgente ? 'text-red-700' : 'text-amber-700'}`}>
                          {a.diasRestantes} día{a.diasRestantes !== 1 ? 's' : ''}
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
    </div>
  )
}