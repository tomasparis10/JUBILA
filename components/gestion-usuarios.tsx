'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Loader2, UserPlus, ShieldCheck, Shield, KeyRound, Trash2, Save, Users, X, RefreshCw,
} from 'lucide-react'
import {
  listUsuarios,
  crearUsuario,
  actualizarRolUsuario,
  resetearContrasenaUsuario,
  eliminarUsuario,
  type UsuarioListado,
} from '@/app/actions/usuarios'

const ROLES_VALIDOS = ['ADMIN', 'JUBILA'] as const

interface Mensaje { tipo: 'ok' | 'error'; texto: string }

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioListado[]>([])
  const [loading, setLoading] = useState(true)
  const [mensaje, setMensaje] = useState<Mensaje | null>(null)

  // Formulario crear
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoRol, setNuevoRol] = useState<string>('JUBILA')
  const [nuevaClave, setNuevaClave] = useState('')
  const [creando, setCreando] = useState(false)

  // Reset de contraseña modal
  const [resetTarget, setResetTarget] = useState<UsuarioListado | null>(null)
  const [resetClave, setResetClave] = useState('')
  const [resetNuevo, setResetNuevo] = useState('')
  const [resetting, setResetting] = useState(false)

  const [borrandoId, setBorrandoId] = useState<number | null>(null)
  const [guardandoRol, setGuardandoRol] = useState<number | null>(null)
  const [rolDraft, setRolDraft] = useState<Record<number, string>>({})

  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const data = await listUsuarios()
      setUsuarios(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const flash = (m: Mensaje | null) => setMensaje(m)

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nuevoNombre.trim() || !nuevaClave) return
    setCreando(true)
    flash(null)
    const r = await crearUsuario(nuevoNombre.trim(), nuevoRol, nuevaClave)
    if (r.ok) {
      setNuevoNombre('')
      setNuevaClave('')
      setNuevoRol('JUBILA')
      flash({ tipo: 'ok', texto: 'Usuario creado. Entrará con la contraseña inicial y deberá cambiarla.' })
      await load(true)
    } else {
      flash({ tipo: 'error', texto: r.error ?? 'No se pudo crear el usuario.' })
    }
    setCreando(false)
  }

  const handleGuardarRol = async (id: number, rol: string) => {
    setGuardandoRol(id)
    flash(null)
    const r = await actualizarRolUsuario(id, rol)
    if (r.ok) {
      flash({ tipo: 'ok', texto: 'Rol actualizado.' })
      await load(true)
    } else {
      flash({ tipo: 'error', texto: r.error ?? 'No se pudo actualizar el rol.' })
      await load(true)
    }
    setGuardandoRol(null)
  }

  const handleResetear = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!resetTarget || !resetClave) return
    setResetting(true)
    flash(null)
    const r = await resetearContrasenaUsuario(resetTarget.id, resetClave)
    if (r.ok) {
      flash({ tipo: 'ok', texto: `Se reseteó la contraseña de ${resetTarget.nombreUsuario}. Deberá cambiarla al ingresar.` })
      setResetTarget(null)
      setResetClave('')
      await load(true)
    } else {
      flash({ tipo: 'error', texto: r.error ?? 'No se pudo resetear la contraseña.' })
    }
    setResetting(false)
  }

  const handleEliminar = async (u: UsuarioListado) => {
    if (!window.confirm(`¿Eliminar al usuario "${u.nombreUsuario}"? Esta acción no se puede deshacer.`)) return
    setBorrandoId(u.id)
    flash(null)
    const r = await eliminarUsuario(u.id)
    if (r.ok) {
      flash({ tipo: 'ok', texto: `Usuario "${u.nombreUsuario}" eliminado.` })
      await load(true)
    } else {
      flash({ tipo: 'error', texto: r.error ?? 'No se pudo eliminar el usuario.' })
    }
    setBorrandoId(null)
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-[#1e3a8a] mb-1">Gestión de Usuarios</h1>
      <p className="text-sm text-slate-500 mb-6">
        Administración de accesos. Cada usuario tiene un único rol: <span className="font-semibold">ADMIN</span> (acceso total) o{' '}
        <span className="font-semibold">JUBILA</span> (sin carga masiva).
      </p>

      {mensaje && (
        <div className={`mb-5 px-4 py-3 rounded-lg border text-xs font-semibold ${
          mensaje.tipo === 'ok' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {mensaje.texto}
        </div>
      )}

      <div className="flex flex-col gap-5">
        {/* ── Crear usuario ── */}
        <form onSubmit={handleCrear} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <h3 className="flex items-center gap-2 text-xs font-bold text-[#1e3a8a] uppercase tracking-widest mb-3">
            <UserPlus className="w-4 h-4" /> Nuevo usuario
          </h3>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Nombre de usuario
              <input
                type="text"
                value={nuevoNombre}
                onChange={(e) => setNuevoNombre(e.target.value)}
                placeholder="Ej: carlos"
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Rol
              <select
                value={nuevoRol}
                onChange={(e) => setNuevoRol(e.target.value)}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                {ROLES_VALIDOS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
              Contraseña inicial
              <input
                type="text"
                value={nuevaClave}
                onChange={(e) => setNuevaClave(e.target.value)}
                placeholder="5 a 25 caracteres"
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <button
              type="submit"
              disabled={creando || !nuevoNombre.trim() || nuevaClave.length < 5}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition"
            >
              {creando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Crear usuario
            </button>
            <p className="text-[10px] text-slate-400 w-full">El usuario deberá cambiar la contraseña al primer ingreso.</p>
          </div>
        </form>

        {/* ── Grilla de usuarios ── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-bold text-[#1e3a8a] uppercase tracking-widest flex-1">
              {loading ? 'Cargando...' : `${usuarios.length} usuario${usuarios.length !== 1 ? 's' : ''}`}
            </span>
            <button
              type="button"
              onClick={() => void load(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 text-[10px] font-semibold transition flex-shrink-0"
            >
              <RefreshCw className="w-3 h-3" /> Actualizar
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16">
              <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-sm text-slate-400">Cargando usuarios...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider">Usuario</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-600 uppercase tracking-wider">Rol</th>
                    <th className="px-4 py-2.5 text-center font-bold text-slate-600 uppercase tracking-wider w-40">Debe cambiar</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-600 uppercase tracking-wider">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-semibold text-slate-800">{u.nombreUsuario}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${
                            u.rol === 'ADMIN'
                              ? 'bg-[#1e3a8a]/10 border-[#1e3a8a]/30 text-[#1e3a8a]'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}>
                            {u.rol === 'ADMIN' ? <ShieldCheck className="w-3 h-3" /> : <Shield className="w-3 h-3" />}
                            {u.rol}
                          </span>
                          <select
                            value={rolDraft[u.id] ?? u.rol}
                            disabled={guardandoRol === u.id}
                            onChange={(e) => setRolDraft((d) => ({ ...d, [u.id]: e.target.value }))}
                            onBlur={(e) => {
                              const nuevoRolVal = e.target.value
                              if (nuevoRolVal && nuevoRolVal !== u.rol) void handleGuardarRol(u.id, nuevoRolVal)
                            }}
                            className="h-8 rounded-md border border-slate-300 bg-white px-2 text-[11px] text-slate-700 outline-none focus:border-blue-500 disabled:opacity-50"
                          >
                            {ROLES_VALIDOS.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                          {guardandoRol === u.id && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                          {rolDraft[u.id] && rolDraft[u.id] !== u.rol && (
                            <button
                              type="button"
                              onClick={() => void handleGuardarRol(u.id, rolDraft[u.id]!)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold hover:bg-emerald-100"
                            >
                              <Save className="w-3 h-3" /> Guardar
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.debeCambiarContrasena ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {u.debeCambiarContrasena ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => { setResetTarget(u); setResetClave('') }}
                            title="Resetear contraseña"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-[#1e3a8a] text-[10px] font-semibold transition"
                          >
                            <KeyRound className="w-3 h-3" /> Resetear clave
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleEliminar(u)}
                            disabled={borrandoId === u.id}
                            title="Eliminar usuario"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-700 text-[10px] font-semibold transition disabled:opacity-50"
                          >
                            {borrandoId === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Modal resetear contraseña ── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form onSubmit={handleResetear} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-[#1e3a8a]">Resetear contraseña</h3>
              <button type="button" onClick={() => setResetTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Se asignará una contraseña temporal a <span className="font-semibold text-slate-700">{resetTarget.nombreUsuario}</span>. Al ingresar, deberá cambiarla.
            </p>
            <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600 mb-4">
              Contraseña temporal
              <input
                type="text"
                value={resetClave}
                onChange={(e) => setResetClave(e.target.value)}
                placeholder="5 a 25 caracteres"
                autoFocus
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="px-4 h-9 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={resetting || resetClave.length < 5}
                className="flex items-center gap-2 px-4 h-9 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-bold transition"
              >
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                Asignar contraseña
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}