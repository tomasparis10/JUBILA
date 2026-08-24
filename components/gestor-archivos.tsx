'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Upload, X, FileText, Image, Eye, Trash2, Loader2,
  AlertCircle, CheckCircle2, FileUp, FolderOpen,
} from 'lucide-react'
import { listarArchivos, subirArchivos, eliminarArchivo, type ArchivoMeta } from '@/app/actions/archivos'

const MAX_ARCHIVOS = 5
const MAX_SIZE_MB = 10
const EXTENSIONES_PERMITIDAS = ['pdf', 'jpg', 'jpeg', 'png']

interface GestorArchivosProps {
  jubilaId: number | null
  /** Si el JUBILA es un agente sin jubilacion registrada aun, deshabilitar upload */
  disabled?: boolean
}

interface VisorState {
  open: boolean
  url: string
  tipo: string | null
  nombre: string
  loading: boolean
  error: string | null
}

export function GestorArchivos({ jubilaId, disabled = false }: GestorArchivosProps) {
  const [archivos, setArchivos] = useState<ArchivoMeta[]>([])
  const [loadingLista, setLoadingLista] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null)
  const [uploadingFiles, setUploadingFiles] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [stagedFiles, setStagedFiles] = useState<File[]>([])

  const inputRef = useRef<HTMLInputElement>(null)
  const dragCounter = useRef(0)

  const [visor, setVisor] = useState<VisorState>({
    open: false, url: '', tipo: null, nombre: '', loading: false, error: null,
  })

  // Cargar lista al montar o cuando cambia jubilaId
  useEffect(() => {
    if (!jubilaId) {
      setArchivos([])
      return
    }
    let cancelled = false
    setLoadingLista(true)
    listarArchivos(jubilaId).then((lista) => {
      if (!cancelled) {
        setArchivos(lista)
        setLoadingLista(false)
      }
    }).catch(() => {
      if (!cancelled) setLoadingLista(false)
    })
    return () => { cancelled = true }
  }, [jubilaId])

  // Validar archivos seleccionados
  const validarYStagear = useCallback((files: FileList | File[]) => {
    setUploadError(null)
    const arr = Array.from(files)
    const total = stagedFiles.length + arr.length

    if (total > MAX_ARCHIVOS) {
      setUploadError(`Solo se permiten hasta ${MAX_ARCHIVOS} archivos por vez.`)
      return
    }

    const invalidos: string[] = []
    const validos: File[] = []

    for (const f of arr) {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
        invalidos.push(`"${f.name}": extension no permitida (solo PDF, JPG, PNG).`)
        continue
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        invalidos.push(`"${f.name}": excede ${MAX_SIZE_MB} MB.`)
        continue
      }
      validos.push(f)
    }

    if (invalidos.length > 0) setUploadError(invalidos.join('\n'))
    if (validos.length > 0) setStagedFiles((prev) => [...prev, ...validos])
  }, [stagedFiles.length])

  // Upload a la DB
  const handleUpload = async () => {
    if (!jubilaId || stagedFiles.length === 0) return
    setUploadingFiles(true)
    setUploadError(null)
    setUploadSuccess(null)

    const fd = new FormData()
    for (const f of stagedFiles) fd.append('archivos', f)

    try {
      const result = await subirArchivos(fd, jubilaId)
      if (result.subidos > 0) {
        setUploadSuccess(`${result.subidos} archivo(s) subido(s) correctamente.`)
        setStagedFiles([])
        // Refrescar lista
        const lista = await listarArchivos(jubilaId)
        setArchivos(lista)
      }
      if (result.errores.length > 0) {
        setUploadError(result.errores.join('\n'))
      }
    } catch {
      setUploadError('Error inesperado al subir los archivos.')
    } finally {
      setUploadingFiles(false)
    }
  }

  // Eliminar archivo
  const handleDelete = async (id: number) => {
    if (!confirm('¿Esta seguro de eliminar este archivo? Esta accion no se puede deshacer.')) return
    setDeletingId(id)
    try {
      const result = await eliminarArchivo(id)
      if (result.ok) {
        setArchivos((prev) => prev.filter((a) => a.id !== id))
      } else {
        setUploadError(result.error ?? 'Error al eliminar el archivo.')
      }
    } catch {
      setUploadError('Error inesperado al eliminar.')
    } finally {
      setDeletingId(null)
    }
  }

  // Abrir visor: fetch del buffer via route handler
  const handleVerArchivo = async (archivo: ArchivoMeta) => {
    setVisor({ open: true, url: '', tipo: archivo.tipo, nombre: archivo.nombre, loading: true, error: null })
    try {
      const res = await fetch(`/api/archivos?id=${archivo.id}`)
      if (!res.ok) throw new Error('No se pudo obtener el archivo.')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      setVisor((v) => ({ ...v, url, loading: false }))
    } catch (err) {
      setVisor((v) => ({ ...v, loading: false, error: 'No se pudo cargar el archivo para visualizacion.' }))
    }
  }

  const cerrarVisor = () => {
    if (visor.url) URL.revokeObjectURL(visor.url)
    setVisor({ open: false, url: '', tipo: null, nombre: '', loading: false, error: null })
  }

  // Drag & Drop handlers
  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current++
    setIsDragging(true)
  }
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }
  const onDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (disabled || !e.dataTransfer.files.length) return
    validarYStagear(e.dataTransfer.files)
  }

  const esPdf = (tipo: string | null, nombre: string) => {
    if (tipo === 'application/pdf') return true
    return nombre.toLowerCase().endsWith('.pdf')
  }

  const formatFecha = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    } catch { return iso }
  }

  return (
    <div className="space-y-4">

      {/* ── Modal Visor ──────────────────────────────────────────────────────── */}
      {visor.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-[#1e3a8a]">
              <div className="flex items-center gap-2.5 min-w-0">
                {esPdf(visor.tipo, visor.nombre) ? (
                  <FileText className="w-4 h-4 text-white flex-shrink-0" />
                ) : (
                  <Image className="w-4 h-4 text-white flex-shrink-0" />
                )}
                <span className="text-sm font-semibold text-white truncate">{visor.nombre}</span>
              </div>
              <button
                onClick={cerrarVisor}
                className="ml-4 text-white/70 hover:text-white transition flex-shrink-0 p-1 rounded hover:bg-white/10"
                aria-label="Cerrar visor"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-hidden bg-slate-100 flex items-center justify-center">
              {visor.loading && (
                <div className="flex flex-col items-center gap-3 text-slate-500">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1e3a8a]" />
                  <span className="text-sm">Cargando archivo...</span>
                </div>
              )}
              {visor.error && (
                <div className="flex flex-col items-center gap-3 text-red-600">
                  <AlertCircle className="w-8 h-8" />
                  <span className="text-sm">{visor.error}</span>
                </div>
              )}
              {!visor.loading && !visor.error && visor.url && (
                esPdf(visor.tipo, visor.nombre) ? (
                  <iframe
                    src={visor.url}
                    className="w-full h-full border-0"
                    title={visor.nombre}
                  />
                ) : (
                  <img
                    src={visor.url}
                    alt={visor.nombre}
                    className="max-w-full max-h-full object-contain p-4"
                  />
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Zona de upload ───────────────────────────────────────────────────── */}
      {!disabled && (
        <div className="space-y-3">
          {/* Drop zone */}
          <div
            onDragEnter={onDragEnter}
            onDragLeave={onDragLeave}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => !disabled && inputRef.current?.click()}
            className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200
              ${isDragging
                ? 'border-[#1e3a8a] bg-blue-50 scale-[1.01]'
                : 'border-slate-200 hover:border-[#1e3a8a] hover:bg-slate-50/80 bg-white'
              }`}
          >
            <input
              ref={inputRef}
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              className="hidden"
              onChange={(e) => e.target.files && validarYStagear(e.target.files)}
            />
            <div className="flex flex-col items-center gap-2 pointer-events-none">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                isDragging ? 'bg-[#1e3a8a]' : 'bg-slate-100'
              }`}>
                <FileUp className={`w-5 h-5 ${isDragging ? 'text-white' : 'text-slate-400'}`} />
              </div>
              <p className="text-sm font-medium text-slate-600">
                {isDragging ? 'Soltar archivos aqui' : 'Arrastrar archivos aqui o hacer clic para seleccionar'}
              </p>
              <p className="text-xs text-slate-400">
                PDF, JPG, PNG &mdash; max. {MAX_SIZE_MB} MB por archivo &mdash; hasta {MAX_ARCHIVOS} archivos
              </p>
            </div>
          </div>

          {/* Archivos en cola */}
          {stagedFiles.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  {stagedFiles.length} archivo(s) listo(s) para subir
                </span>
                <button
                  onClick={() => setStagedFiles([])}
                  className="text-xs text-red-500 hover:text-red-700 transition font-medium"
                >
                  Limpiar todo
                </button>
              </div>
              <ul className="divide-y divide-slate-50">
                {stagedFiles.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/50 transition">
                    {f.type === 'application/pdf' || f.name.endsWith('.pdf') ? (
                      <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                    ) : (
                      <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                    <span className="text-sm text-slate-700 truncate flex-1">{f.name}</span>
                    <span className="text-xs text-slate-400 flex-shrink-0">
                      {(f.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                    <button
                      onClick={() => setStagedFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-slate-400 hover:text-red-500 transition flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={handleUpload}
                  disabled={uploadingFiles || !jubilaId}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold transition shadow-sm"
                >
                  {uploadingFiles ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Subiendo...</>
                  ) : (
                    <><Upload className="w-3.5 h-3.5" /> Subir a la base de datos</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Mensajes de feedback */}
          {uploadError && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="whitespace-pre-line">{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="ml-auto text-red-400 hover:text-red-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          {uploadSuccess && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{uploadSuccess}</span>
              <button onClick={() => setUploadSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Lista de archivos existentes ─────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" />
            Documentos adjuntos
            {!loadingLista && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold">
                {archivos.length}
              </span>
            )}
          </h4>
          {loadingLista && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />}
        </div>

        {!loadingLista && archivos.length === 0 && (
          <div className="py-8 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <FolderOpen className="w-6 h-6 text-slate-300 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No hay documentos adjuntos.</p>
            {!jubilaId && (
              <p className="text-xs text-slate-300 mt-1">
                El agente debe tener un registro de jubilacion para adjuntar archivos.
              </p>
            )}
          </div>
        )}

        {archivos.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Archivo</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Fecha</th>
                  <th className="text-right px-3 py-2 font-semibold text-slate-500 uppercase tracking-wider">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {archivos.map((a) => (
                  <tr key={a.id} className="hover:bg-blue-50/30 transition-colors group">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {esPdf(a.tipo, a.nombre) ? (
                          <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <Image className="w-4 h-4 text-blue-500 flex-shrink-0" />
                        )}
                        <span className="text-slate-700 font-medium truncate max-w-[200px]">{a.nombre}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-400 whitespace-nowrap hidden sm:table-cell">
                      {formatFecha(a.fechaSubida)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleVerArchivo(a)}
                          title="Ver archivo"
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-100 hover:bg-[#1e3a8a] hover:text-white text-slate-600 border border-slate-200 hover:border-[#1e3a8a] transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Ver</span>
                        </button>
                        {!disabled && (
                          <button
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                            title="Eliminar archivo"
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 hover:bg-red-600 hover:text-white text-red-500 border border-red-200 hover:border-red-600 transition-all disabled:opacity-50"
                          >
                            {deletingId === a.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
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
  )
}
