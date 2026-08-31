'use client'

import { Shield, LayoutDashboard, Settings, FileText, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type OpMode = 'agregar-agente' | 'actualizacion-masiva'

type NavSection = 'inicio' | 'operaciones' | 'informes'

interface SidebarProps {
  activeSection: NavSection
  onSectionChange: (section: NavSection) => void
  expandedOp: boolean
  onToggleOp: () => void
  activeOp: OpMode | null
  onOpSelect: (op: OpMode) => void
}

const opSubItems: { key: OpMode; label: string }[] = [
  { key: 'agregar-agente', label: 'Agregar Nuevo Agente' },
  { key: 'actualizacion-masiva', label: 'Actualización Masiva' },
]

export default function Sidebar({
  activeSection,
  onSectionChange,
  expandedOp,
  onToggleOp,
  activeOp,
  onOpSelect,
}: SidebarProps) {
  return (
    <aside className="flex flex-col w-56 min-h-screen bg-[#172554] text-slate-200 flex-shrink-0">
      {/* Brand */}
      <div className="flex flex-col items-center px-4 pt-6 pb-5 border-b border-[#1e3a8a]">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#1e3a8a] mb-3">
          <Shield className="w-5 h-5 text-blue-300" />
        </div>
        <p className="text-[11px] font-bold text-blue-200 tracking-widest uppercase text-center leading-tight">
          Municipalidad
        </p>
        <p className="text-[11px] text-blue-400 tracking-wide text-center leading-tight mt-0.5">
          Sistema de Jubila
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-1 px-3 pt-4 flex-1">
        {/* INICIO */}
        <button
          onClick={() => onSectionChange('inicio')}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors w-full text-left',
            activeSection === 'inicio'
              ? 'bg-[#1d4ed8] text-white'
              : 'text-blue-200 hover:bg-[#1e3a8a] hover:text-white'
          )}
        >
          <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
          <span>INICIO</span>
        </button>

        {/* OPERACIONES */}
        <div>
          <button
            onClick={() => {
              onSectionChange('operaciones')
              onToggleOp()
            }}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors w-full text-left',
              activeSection === 'operaciones'
                ? 'bg-[#1d4ed8] text-white'
                : 'text-blue-200 hover:bg-[#1e3a8a] hover:text-white'
            )}
          >
            <Settings className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1">OPERACIONES</span>
            <ChevronRight
              className={cn(
                'w-3.5 h-3.5 transition-transform',
                expandedOp && 'rotate-90'
              )}
            />
          </button>

          {expandedOp && (
            <div className="flex flex-col gap-0.5 mt-1 ml-4 pl-3 border-l border-[#1e3a8a]">
              {opSubItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onOpSelect(item.key)}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors w-full text-left',
                    activeOp === item.key
                      ? 'bg-[#1d4ed8] text-white font-semibold'
                      : 'text-blue-300 hover:text-white hover:bg-[#1e3a8a]'
                  )}
                >
                  <span className="w-1 h-1 rounded-full bg-blue-400 flex-shrink-0" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* INFORMES */}
        <button
          onClick={() => onSectionChange('informes')}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold tracking-wide transition-colors w-full text-left',
            activeSection === 'informes'
              ? 'bg-[#1d4ed8] text-white'
              : 'text-blue-200 hover:bg-[#1e3a8a] hover:text-white'
          )}
        >
          <FileText className="w-4 h-4 flex-shrink-0" />
          <span>INFORMES</span>
        </button>
      </nav>

      {/* Footer */}
      <div className="px-4 pb-4 pt-2 border-t border-[#1e3a8a]">
        <p className="text-[10px] text-blue-500 text-center">v2.4.1 · RRHH Área Jubilaciones</p>
      </div>
    </aside>
  )
}
