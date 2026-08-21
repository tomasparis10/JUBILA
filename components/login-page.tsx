'use client'

import { useState } from 'react'
import { Shield, User, Lock, LogIn, Eye, EyeOff, Loader2 } from 'lucide-react'
import { loginUsuario } from '@/app/actions/auth'

interface LoginPageProps {
  onLogin: (username: string, userId: number) => void
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!username.trim() || !password.trim()) {
      setError('Por favor complete todos los campos.')
      return
    }
    setLoading(true)
    try {
      const result = await loginUsuario(username.trim(), password.trim())
      if (result.ok && result.username && result.userId != null) {
        onLogin(result.username, result.userId)
      } else {
        setError(result.error ?? 'Usuario o contraseña incorrectos.')
      }
    } catch {
      setError('Error de conexión. Intente nuevamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#dce8f5]">
      <div className="w-full max-w-md mx-4">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#1e3a8a]">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <span className="text-sm font-bold text-[#1e3a8a] tracking-wider uppercase">
              Municipalidad de Córdoba
            </span>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-[#1e3a8a] mb-1 leading-tight">
            Sistema de Gestión de Jubila
          </h1>
          <p className="text-sm text-slate-500 mb-7">Módulo: Jubilacion</p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Username */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="username">
                Usuario
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="username"
                  type="text"
                  placeholder="Ej: Juan Escobar"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#93c5fd] focus:border-[#1e3a8a] transition"
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-slate-800 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#93c5fd] focus:border-[#1e3a8a] transition"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] text-white font-semibold text-sm transition disabled:opacity-60 disabled:cursor-not-allowed mt-1"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verificando...
                </span>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  Ingresar al Sistema
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <hr className="my-6 border-slate-100" />

          {/* Footer */}
          <div className="text-xs text-slate-400 leading-relaxed">
            <p>Acceso restringido a personal autorizado.</p>
            <p>Soporte TI: int. 4421 · soporte@municipalidad.gob.ar</p>
          </div>
        </div>
      </div>
    </div>
  )
}
