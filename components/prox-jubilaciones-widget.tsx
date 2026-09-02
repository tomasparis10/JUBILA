'use client'

import { useEffect, useState } from 'react'
import { Clock, AlertTriangle, Loader2, UserCircle } from 'lucide-react'
import { getAgentesProxJubilacion, type AgenteProxJubilacion } from '@/app/actions/agentes'

interface ProxJubilacionesWidgetProps {
  onAgenteClick: (dni: string) => void
}

export default function ProxJubilacionesWidget({ onAgenteClick }: ProxJubilacionesWidgetProps) {
  const [agentes, setAgentes] = useState<AgenteProxJubilacion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const data = await getAgentesProxJubilacion()
        if (!cancelled) setAgentes(data)
      } catch {
        if (!cancelled) setAgentes([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

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
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-amber-400 text-[9px] font-black text-[#172554] flex-shrink-0">
            {agentes.length}
          </span>
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
              <li key={ag.dni}>
                <button
                  onClick={() => onAgenteClick(ag.dni)}
                  className="w-full text-left px-3 py-2.5 hover:bg-[#1e3a8a]/60 transition-colors group"
                >
                  <div className="flex items-start gap-2">
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
    </div>
  )
}
