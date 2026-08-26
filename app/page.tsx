'use client'

import { useState } from 'react'
import LoginPage from '@/components/login-page'
import Sidebar from '@/components/sidebar'
import TopBar from '@/components/top-bar'
import PanelPrincipal from '@/components/panel-principal'
import InformesAnaliticas from '@/components/informes-analiticas'

type NavSection = 'inicio' | 'operaciones' | 'informes'

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState<number>(1)
  const [activeSection, setActiveSection] = useState<NavSection>('inicio')
  const [expandedOp, setExpandedOp] = useState(false)

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
  }

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} />
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#eef2f7]">
      {/* Sidebar */}
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        expandedOp={expandedOp}
        onToggleOp={() => setExpandedOp((v) => !v)}
      />

      {/* Right side: topbar + main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar username={username} onLogout={handleLogout} />

        {activeSection === 'inicio' && (
          <main className="flex-1 overflow-y-auto">
            <PanelPrincipal />
          </main>
        )}

        {activeSection === 'operaciones' && (
          <main className="flex-1 overflow-y-auto p-6">
            <h1 className="text-xl font-bold text-slate-800 mb-2">Operaciones</h1>
            <p className="text-slate-500 text-sm">
              Seleccione una operación del menú lateral para continuar.
            </p>
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
