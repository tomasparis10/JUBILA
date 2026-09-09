'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import LoginPage from '@/components/login-page'
import Sidebar from '@/components/sidebar'
import TopBar from '@/components/top-bar'
import PanelPrincipal from '@/components/panel-principal'
import InformesAnaliticas from '@/components/informes-analiticas'
import OperacionesPanel from '@/components/operaciones-panel'
import ProxJubilacionesPanel from '@/components/prox-jubilaciones-widget'
import { getCurrentSession, logoutUsuario } from '@/app/actions/auth'

type NavSection = 'inicio' | 'operaciones' | 'informes' | 'prox-jubilar'
type OpMode = 'agregar-agente' | 'actualizacion-masiva'

export default function App() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState<number>(1)
  const [activeSection, setActiveSection] = useState<NavSection>('inicio')
  const [expandedOp, setExpandedOp] = useState(false)
  const [activeOp, setActiveOp] = useState<OpMode | null>(null)
  const [externalDni, setExternalDni] = useState<string | null>(null)

  const handleLogin = (name: string, id: number) => {
    setUsername(name)
    setUserId(id)
    setLoggedIn(true)
  }

  useEffect(() => {
    let active = true
    getCurrentSession().then((session) => {
      if (!active) return
      if (session.ok && session.username && session.userId != null) {
        setUsername(session.username)
        setUserId(session.userId)
        setLoggedIn(true)
      } else {
        setLoggedIn(false)
      }
    })
    return () => { active = false }
  }, [])

  const handleLogout = async () => {
    try {
      await logoutUsuario()
    } finally {
      setLoggedIn(false)
      setUsername('')
      setUserId(1)
      setActiveSection('inicio')
      setExpandedOp(false)
      setActiveOp(null)
      setExternalDni(null)
    }
  }

  const handleOpSelect = (op: OpMode) => {
    setActiveSection('operaciones')
    setActiveOp(op)
    setExpandedOp(true)
  }

  const handleAgenteSelect = (dni: string) => {
    setActiveSection('inicio')
    setExternalDni(dni)
  }

  if (loggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#dce8f5]">
        <Loader2 className="w-7 h-7 animate-spin text-[#1e3a8a]" />
      </div>
    )
  }

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef2f7]">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={(section) => {
          setActiveSection(section)
          if (section !== 'operaciones') setActiveOp(null)
        }}
        expandedOp={expandedOp}
        onToggleOp={() => setExpandedOp((v) => !v)}
        activeOp={activeOp}
        onOpSelect={handleOpSelect}
      />

      {/* Right side: topbar + main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar username={username} onLogout={handleLogout} />

        {activeSection === 'inicio' && (
          <main className="flex-1 overflow-y-auto">
            <PanelPrincipal
              externalDni={externalDni}
              onExternalDniConsumed={() => setExternalDni(null)}
            />
          </main>
        )}

        {activeSection === 'operaciones' && (
          <main className="flex-1 overflow-y-auto">
            <OperacionesPanel activeOp={activeOp} onChangeOp={handleOpSelect} />
          </main>
        )}

        {activeSection === 'informes' && (
          <main className="flex-1 overflow-y-auto">
            <InformesAnaliticas />
          </main>
        )}

        {activeSection === 'prox-jubilar' && (
          <main className="flex-1 overflow-y-auto p-6">
            <ProxJubilacionesPanel onAgenteClick={handleAgenteSelect} />
          </main>
        )}
      </div>
    </div>
  )
}
