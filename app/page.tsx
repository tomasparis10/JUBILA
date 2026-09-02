'use client'

import { useState } from 'react'
import LoginPage from '@/components/login-page'
import Sidebar from '@/components/sidebar'
import TopBar from '@/components/top-bar'
import PanelPrincipal from '@/components/panel-principal'
import InformesAnaliticas from '@/components/informes-analiticas'
import OperacionesPanel from '@/components/operaciones-panel'

type NavSection = 'inicio' | 'operaciones' | 'informes'
type OpMode = 'agregar-agente' | 'actualizacion-masiva'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
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

  const handleLogout = () => {
    setLoggedIn(false)
    setUsername('')
    setActiveSection('inicio')
    setExpandedOp(false)
    setActiveOp(null)
    setExternalDni(null)
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
        onAgenteSelect={handleAgenteSelect}
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
      </div>
    </div>
  )
}
