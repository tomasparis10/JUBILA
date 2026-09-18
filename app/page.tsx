'use client'

import { useEffect, useState } from 'react'
import LoginPage from '@/components/login-page'
import Sidebar from '@/components/sidebar'
import TopBar from '@/components/top-bar'
import PanelPrincipal from '@/components/panel-principal'
import InformesAnaliticas from '@/components/informes-analiticas'
import OperacionesPanel from '@/components/operaciones-panel'
import ProxJubilacionesPanel from '@/components/prox-jubilaciones-widget'
import AlertasPanel from '@/components/alertas-panel'
import GestionUsuarios from '@/components/gestion-usuarios'
import { getCurrentSession, logoutUsuario } from '@/app/actions/auth'
import CambiarContrasena from '@/components/cambiar-contrasena'

type NavSection = 'inicio' | 'operaciones' | 'informes' | 'prox-jubilar' | 'alertas' | 'usuarios'
type OpMode = 'agregar-agente' | 'actualizacion-masiva'

export default function App() {
  // Renderiza el acceso de inmediato; la sesión existente se recupera en segundo plano.
  const [loggedIn, setLoggedIn] = useState(false)
  const [username, setUsername] = useState('')
  const [userId, setUserId] = useState<number>(1)
  const [role, setRole] = useState<string>('JUBILA')
  const [activeSection, setActiveSection] = useState<NavSection>('inicio')
  const [expandedOp, setExpandedOp] = useState(false)
  const [activeOp, setActiveOp] = useState<OpMode | null>(null)
  const [externalDni, setExternalDni] = useState<string | null>(null)
  const [mustChangePassword, setMustChangePassword] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)

  const handleLogin = (name: string, id: number, mustChange = false, userRole: string = 'JUBILA') => {
    setUsername(name)
    setUserId(id)
    setRole(userRole)
    setLoggedIn(true)
    setMustChangePassword(mustChange)
  }

  useEffect(() => {
    let active = true
    getCurrentSession().then((session) => {
      if (!active) return
      if (session.ok && session.username && session.userId != null) {
        setUsername(session.username)
        setUserId(session.userId)
        setRole(session.role ?? 'JUBILA')
        setLoggedIn(true)
        setMustChangePassword(Boolean(session.mustChangePassword))
      } else {
        setLoggedIn(false)
      }
    }).catch(() => {
      if (active) setLoggedIn(false)
    })
    return () => {
      active = false
    }
  }, [])

  const handleLogout = async () => {
    try {
      await logoutUsuario()
    } finally {
      setLoggedIn(false)
      setUsername('')
      setUserId(1)
      setRole('JUBILA')
      setActiveSection('inicio')
      setExpandedOp(false)
      setActiveOp(null)
      setExternalDni(null)
    }
  }

  const handleOpSelect = (op: OpMode) => {
    if (op === 'actualizacion-masiva' && role !== 'ADMIN') return
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

  if (mustChangePassword || showChangePassword) {
    return <CambiarContrasena obligatorio={mustChangePassword} onBack={() => setShowChangePassword(false)} onDone={() => {
      setMustChangePassword(false)
      setShowChangePassword(false)
    }} />
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
        role={role}
      />

      {/* Right side: topbar + main */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar username={username} onLogout={handleLogout} onChangePassword={() => setShowChangePassword(true)} />

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
            <OperacionesPanel activeOp={activeOp} onChangeOp={handleOpSelect} role={role} />
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

        {activeSection === 'alertas' && (
          <main className="flex-1 overflow-y-auto">
            <AlertasPanel />
          </main>
        )}

        {activeSection === 'usuarios' && role === 'ADMIN' && (
          <main className="flex-1 overflow-y-auto">
            <GestionUsuarios />
          </main>
        )}
      </div>
    </div>
  )
}
