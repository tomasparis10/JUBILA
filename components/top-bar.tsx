'use client'

import { useEffect, useState } from 'react'
import { Clock, LogOut, User } from 'lucide-react'

interface TopBarProps {
  username: string
  onLogout: () => void
}

const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatDateTime(date: Date) {
  const day = DAYS_ES[date.getDay()]
  const d = date.getDate()
  const month = MONTHS_ES[date.getMonth()]
  const year = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return { date: `${day}, ${d} ${month} ${year}`, time: `${hh}:${mm}` }
}

export default function TopBar({ username, onLogout }: TopBarProps) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  const { date, time } = formatDateTime(now)

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
      {/* Date & Time */}
      <div className="flex items-center gap-2 text-slate-500">
        <Clock className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-medium capitalize">{date}</span>
        <span className="text-sm font-bold text-slate-700">{time}</span>
      </div>

      {/* User & Logout */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-lg border border-slate-200">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-700">{username}</span>
        </div>
        <button
          onClick={onLogout}
          title="Cerrar sesión"
          className="flex items-center justify-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition"
          aria-label="Cerrar sesión"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
