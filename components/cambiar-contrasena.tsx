'use client'

import { FormEvent, useState } from 'react'
import { changePassword } from '@/app/actions/auth'

export default function CambiarContrasena({ obligatorio = false, onDone, onBack }: { obligatorio?: boolean; onDone?: () => void; onBack?: () => void }) {
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    if (nueva !== confirmacion) return setError('Las contraseñas nuevas no coinciden.')
    setLoading(true)
    try {
      const result = await changePassword(actual, nueva)
      if (!result.ok) setError(result.error ?? 'No se pudo cambiar la contraseña.')
      else onDone?.()
    } catch { setError('No se pudo cambiar la contraseña.') }
    finally { setLoading(false) }
  }

  return <main className="min-h-screen flex items-center justify-center bg-[#dce8f5] p-4">
    <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg space-y-4">
      <h1 className="text-xl font-bold text-[#1e3a8a]">{obligatorio ? 'Cambiar contraseña temporal' : 'Cambiar contraseña'}</h1>
      {obligatorio && <p className="text-sm text-slate-600">Por seguridad, debe establecer una contraseña personal antes de continuar.</p>}
      <label className="block text-sm font-semibold text-slate-700">Contraseña actual
        <input className="mt-1 w-full rounded-lg border p-3 font-normal" type="password" placeholder="Ingrese su contraseña actual" value={actual} onChange={(e) => setActual(e.target.value)} required />
      </label>
      <label className="block text-sm font-semibold text-slate-700">Nueva contraseña
        <input className="mt-1 w-full rounded-lg border p-3 font-normal" type="password" placeholder="Entre 5 y 25 caracteres" value={nueva} onChange={(e) => setNueva(e.target.value)} minLength={5} maxLength={25} required />
      </label>
      <label className="block text-sm font-semibold text-slate-700">Confirmar nueva contraseña
        <input className="mt-1 w-full rounded-lg border p-3 font-normal" type="password" placeholder="Repita la nueva contraseña" value={confirmacion} onChange={(e) => setConfirmacion(e.target.value)} minLength={5} maxLength={25} required />
      </label>
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button className="w-full rounded-lg bg-[#1e3a8a] p-3 font-semibold text-white disabled:opacity-60" disabled={loading}>{loading ? 'Guardando...' : 'Guardar contraseña'}</button>
      {!obligatorio && <button type="button" onClick={onBack} className="w-full rounded-lg border border-slate-200 p-3 font-semibold text-slate-600 hover:bg-slate-50">Volver al inicio</button>}
    </form>
  </main>
}
