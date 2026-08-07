'use client'

import { PlusCircle, CheckCircle2 } from 'lucide-react'
import { type JubilacionRecord } from '@/lib/jubilaciones-data'

interface ActionsPanelProps {
  onNew: () => void
  saved: boolean
  selectedRecord: JubilacionRecord | null
}

export default function ActionsPanel({ onNew, saved }: ActionsPanelProps) {
  return (
    <aside className="flex-shrink-0 w-44 border-l border-slate-200 bg-white p-4 flex flex-col gap-3">
      {saved && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="text-xs font-semibold text-emerald-700">Guardado</span>
        </div>
      )}

      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        Registro
      </p>

      <button
        onClick={onNew}
        className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
      >
        <PlusCircle className="w-4 h-4" />
        <span>Agregar Nuevo</span>
      </button>
    </aside>
  )
}
