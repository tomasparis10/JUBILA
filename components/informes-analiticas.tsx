'use client'

import { useState, useEffect } from 'react'
import {
  BarChart2, Users, Clock, AlertTriangle, TrendingUp, TrendingDown,
  Download, FileBarChart, Activity, CheckCircle2, RefreshCcw,
  FileText, Calendar, BarChart, Shield, FileEdit,
} from 'lucide-react'
import { getAgentesFaltaUnAno } from '@/app/actions/agentes'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface BeneficioItem {
  label: string; count: number; pct: number; color: string
}
interface MonthItem {
  mes: string; nuevos: number; cerrados: number
}
interface SecretariaItem {
  label: string; count: number; pct: number; color: string
}
interface InformeCard {
  id: string; titulo: string; tipo: string; tipoColor: string; tipoBg: string
  paginas: number; fecha: string; descripcion: string
  iconBg: string; iconColor: string; accentColor: string
  icon: React.ReactNode
}

// ── Datos ─────────────────────────────────────────────────────────────────────

const CAUSA_BAJA_DIST: BeneficioItem[] = [
  { label: 'Jubilación',       count: 356, pct: 42, color: '#1d4ed8' },
  { label: 'Renuncia',         count: 203, pct: 24, color: '#7c3aed' },
  { label: 'Invalidez',        count: 152, pct: 18, color: '#059669' },
  { label: 'Fallecimiento',    count: 85,  pct: 10, color: '#d97706' },
  { label: 'Otras causas',     count: 51,  pct: 6,  color: '#dc2626' },
]

const MAX_MONTHLY = 50
const MONTHLY_EVOLUTION: MonthItem[] = [
  { mes: 'Mar', nuevos: 28, cerrados: 21 },
  { mes: 'Abr', nuevos: 34, cerrados: 18 },
  { mes: 'May', nuevos: 22, cerrados: 30 },
  { mes: 'Jun', nuevos: 41, cerrados: 25 },
  { mes: 'Jul', nuevos: 37, cerrados: 33 },
  { mes: 'Ago', nuevos: 12, cerrados: 9  },
]

// Secretarías: left col y right col según capturas
const SECRETARIA_LEFT: SecretariaItem[] = [
  { label: 'Sec. de Salud',        count: 262, pct: 31, color: '#1d4ed8' },
  { label: 'Sec. de Obras Públicas', count: 144, pct: 17, color: '#059669' },
  { label: 'Otras Secretarías',    count: 94,  pct: 11, color: '#6b7280' },
]
const SECRETARIA_RIGHT: SecretariaItem[] = [
  { label: 'Sec. de Educación',    count: 237, pct: 28, color: '#7c3aed' },
  { label: 'Sec. General',         count: 110, pct: 13, color: '#d97706' },
]

// ── Componente principal ──────────────────────────────────────────────────────

export default function InformesAnaliticas() {
  const [animBars, setAnimBars] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [showDateRange, setShowDateRange] = useState(false)
  const [draftDateRange, setDraftDateRange] = useState({ from: '', to: '' })
  const [dateRange, setDateRange] = useState({ from: '', to: '' })

  useEffect(() => {
    const t = setTimeout(() => setAnimBars(true), 200)
    return () => clearTimeout(t)
  }, [])

  const descargarInformeFaltaUnAno = async () => {
    setDownloading(true)
    try {
      const agentes = await getAgentesFaltaUnAno(dateRange.from || undefined, dateRange.to || undefined)
      const XLSX = await import('xlsx')
      const rows = agentes.map((agente) => ({
        DNI: agente.dni,
        'Nombre completo': agente.nombreCompleto,
      }))
      const worksheet = XLSX.utils.json_to_sheet(rows)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Falta un año')
      const fechaArchivo = dateRange.from && dateRange.to
        ? `${dateRange.from}_${dateRange.to}`
        : new Date().toISOString().slice(0, 10)
      XLSX.writeFile(workbook, `agentes_falta_un_ano_${fechaArchivo}.xlsx`)
    } finally {
      setDownloading(false)
    }
  }

  // ── KPI cards data (inline para poder usar JSX en icon) ─────────────────────
  const kpis = [
    {
      id: 'total', label: 'Total Jubilaciones Activas', value: '847',
      deltaTxt: '+12', deltaPos: true, deltaDesc: 'vs mes anterior',
      icon: <Users className="w-5 h-5" />,
      iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
      cardBg: 'bg-blue-50/50', border: 'border-blue-100',
      deltaBg: 'bg-blue-50', deltaTextColor: 'text-blue-700',
    },
    {
      id: 'pasividad', label: 'En Pasividad', value: '324',
      deltaTxt: '+8', deltaPos: true, deltaDesc: 'nuevas este mes',
      icon: <CheckCircle2 className="w-5 h-5" />,
      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
      cardBg: 'bg-emerald-50/50', border: 'border-emerald-100',
      deltaBg: 'bg-emerald-50', deltaTextColor: 'text-emerald-700',
    },
    {
      id: 'pendientes', label: 'Trámites Pendientes', value: '53',
      deltaTxt: '-5', deltaPos: false, deltaDesc: 'vs semana pasada',
      icon: <Clock className="w-5 h-5" />,
      iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
      cardBg: 'bg-amber-50/50', border: 'border-amber-100',
      deltaBg: 'bg-amber-50', deltaTextColor: 'text-amber-700',
    },
    {
      id: 'art43', label: 'Con Suspensiones Art. 43', value: '19',
      deltaTxt: '+2', deltaPos: false, deltaDesc: 'nuevas este mes',
      icon: <AlertTriangle className="w-5 h-5" />,
      iconBg: 'bg-rose-100', iconColor: 'text-rose-600',
      cardBg: 'bg-rose-50/50', border: 'border-rose-100',
      deltaBg: 'bg-rose-50', deltaTextColor: 'text-rose-700',
    },
    {
      id: 'edad', label: 'Edad Promedio', value: '63.4',
      deltaTxt: '+0.3', deltaPos: false, deltaDesc: 'años promedio',
      icon: <Activity className="w-5 h-5" />,
      iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
      cardBg: 'bg-violet-50/50', border: 'border-violet-100',
      deltaBg: 'bg-violet-50', deltaTextColor: 'text-violet-700',
    },
    {
      id: 'renovaciones', label: 'Renovaciones Provisorias', value: '112',
      deltaTxt: '-7', deltaPos: true, deltaDesc: 'vs trimestre anterior',
      icon: <RefreshCcw className="w-5 h-5" />,
      iconBg: 'bg-slate-100', iconColor: 'text-slate-600',
      cardBg: 'bg-white', border: 'border-slate-200',
      deltaBg: 'bg-slate-50', deltaTextColor: 'text-slate-600',
    },
  ]

  // ── Informes data ──────────────────────────────────────────────────────────
  const informes: InformeCard[] = [
    {
      id: 'inf-001',
      titulo: 'Agentes a un año de jubilarse',
      tipo: 'Operativo', tipoColor: 'text-blue-700', tipoBg: 'bg-blue-100',
      paginas: 0, fecha: 'Actualizado al descargar',
      descripcion: 'Listado de agentes cuya fecha estimada de jubilación está entre hoy y el último día del mismo mes del año siguiente.',
      iconBg: 'bg-blue-100', iconColor: 'text-blue-600',
      accentColor: 'border-l-blue-500',
      icon: <FileEdit className="w-5 h-5" />,
    },
    {
      id: 'inf-002',
      titulo: 'Reporte de Vencimientos Provisorios',
      tipo: 'Operativo', tipoColor: 'text-amber-700', tipoBg: 'bg-amber-100',
      paginas: 8, fecha: '01/08/2026',
      descripcion: 'Detalle de todas las renovaciones de invalidez provisoria con fechas de vencimiento en los próximos 60 días.',
      iconBg: 'bg-amber-100', iconColor: 'text-amber-600',
      accentColor: 'border-l-amber-500',
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      id: 'inf-003',
      titulo: 'Estadísticas Anuales 2025',
      tipo: 'Anual', tipoColor: 'text-emerald-700', tipoBg: 'bg-emerald-100',
      paginas: 32, fecha: '15/01/2026',
      descripcion: 'Análisis estadístico completo del ejercicio 2025: distribución por tipo de beneficio, evolución, promedios de edad y antigüedad.',
      iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
      accentColor: 'border-l-emerald-500',
      icon: <BarChart className="w-5 h-5" />,
    },
    {
      id: 'inf-004',
      titulo: 'Informe de Suspensiones Art. 43',
      tipo: 'Operativo', tipoColor: 'text-rose-700', tipoBg: 'bg-rose-100',
      paginas: 5, fecha: '08/08/2026',
      descripcion: 'Listado de agentes con suspensión de pagos activa y detalle de expedientes vinculados al Art. 43.',
      iconBg: 'bg-rose-100', iconColor: 'text-rose-600',
      accentColor: 'border-l-rose-500',
      icon: <Shield className="w-5 h-5" />,
    },
  ]

  return (
    <div className="p-6 flex flex-col gap-6 bg-[#eef2f7] min-h-full">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-6 h-6 text-[#1e3a8a]" />
            Informes y Analíticas
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Panel de seguimiento y reportes del sistema de jubilaciones · Actualizado: 12/08/2026
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1e3a8a] text-white text-xs font-bold tracking-wide flex-shrink-0">
          DATOS AL DÍA
        </div>
      </div>

      {/* ── Sección 1: KPIs ────────────────────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Métricas Clave</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {kpis.map((k) => (
            <div
              key={k.id}
              className={`rounded-2xl border ${k.border} ${k.cardBg} p-5 flex flex-col gap-3 shadow-sm`}
            >
              {/* Top row: label + icon */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">{k.label}</span>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${k.iconBg} ${k.iconColor}`}>
                  {k.icon}
                </div>
              </div>

              {/* Value */}
              <div>
                <p className="text-4xl font-extrabold text-slate-800 leading-none">{k.value}</p>
              </div>

              {/* Delta row */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${k.deltaBg} ${k.deltaTextColor}`}>
                  {k.deltaPos
                    ? <TrendingUp className="w-3 h-3" />
                    : <TrendingDown className="w-3 h-3" />
                  }
                  <span className="text-xs font-bold">{k.deltaTxt}</span>
                </div>
                <span className="text-xs text-slate-400">{k.deltaDesc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Sección 2: Gráficos (Causa de baja + Evolución mensual) ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* 2.1 Distribución por Causa de Baja */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-800">Distribución por Causa de Baja</h3>
            <span className="text-xs text-slate-400 font-medium">Total: 847</span>
          </div>
          <div className="flex flex-col gap-4">
            {CAUSA_BAJA_DIST.map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 font-medium">{item.label}</span>
                  <span className="text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{item.count}</span>
                    <span className="text-slate-400 font-normal"> ({item.pct}%)</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: animBars ? `${item.pct}%` : '0%',
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2.2 Evolución Mensual de Trámites */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold text-slate-800">Evolución Mensual de Trámites</h3>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-[#1d4ed8] inline-block" />
                Nuevos
              </span>
              <span className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                Cerrados
              </span>
            </div>
          </div>

          {/* Chart area */}
          <div className="flex items-end gap-3 h-36 mt-2">
            {MONTHLY_EVOLUTION.map((m) => (
              <div key={m.mes} className="flex-1 flex flex-col items-center gap-1">
                <div className="flex items-end gap-1 w-full" style={{ height: '110px' }}>
                  <div
                    className="flex-1 rounded-t-md bg-[#1d4ed8] hover:bg-[#1e40af] transition-all duration-700 ease-out cursor-default"
                    style={{ height: animBars ? `${(m.nuevos / MAX_MONTHLY) * 100}%` : '0%' }}
                    title={`Nuevos: ${m.nuevos}`}
                  />
                  <div
                    className="flex-1 rounded-t-md bg-emerald-500 hover:bg-emerald-600 transition-all duration-700 ease-out cursor-default"
                    style={{ height: animBars ? `${(m.cerrados / MAX_MONTHLY) * 100}%` : '0%' }}
                    title={`Cerrados: ${m.cerrados}`}
                  />
                </div>
                <span className="text-[11px] font-semibold text-slate-500 mt-1">{m.mes}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sección 3: Distribución por Secretaría ──────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-slate-800">Distribución por Secretaría</h3>
          <span className="text-xs text-slate-400 font-medium">Total: 847 jubilaciones</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
          {/* Left column */}
          <div className="flex flex-col gap-4">
            {SECRETARIA_LEFT.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 font-medium">{s.label}</span>
                  <span className="text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{s.count}</span>
                    <span className="text-slate-400 font-normal"> ({s.pct}%)</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: animBars ? `${s.pct}%` : '0%', backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          {/* Right column */}
          <div className="flex flex-col gap-4">
            {SECRETARIA_RIGHT.map((s) => (
              <div key={s.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-700 font-medium">{s.label}</span>
                  <span className="text-sm text-slate-600">
                    <span className="font-bold text-slate-800">{s.count}</span>
                    <span className="text-slate-400 font-normal"> ({s.pct}%)</span>
                  </span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: animBars ? `${s.pct}%` : '0%', backgroundColor: s.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Sección 4: Informes Disponibles ─────────────────────────────────── */}
      <div>
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-3">Informes Disponibles</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {informes.map((inf) => (
            <div
              key={inf.id}
              className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${inf.accentColor} shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden`}
            >
              {/* Body */}
              <div className="p-5 flex gap-4 flex-1">
                {/* Icon box */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${inf.iconBg} ${inf.iconColor}`}>
                  {inf.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-bold text-slate-800 leading-snug">{inf.titulo}</h4>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${inf.tipoBg} ${inf.tipoColor}`}>
                      {inf.tipo}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">{inf.descripcion}</p>
                </div>
              </div>

              {inf.id === 'inf-001' && showDateRange && (
                <div className="mx-5 mb-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                      Desde
                      <input
                        type="date"
                        value={draftDateRange.from}
                        max={draftDateRange.to || undefined}
                        onChange={(event) => setDraftDateRange((range) => ({ ...range, from: event.target.value }))}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-600">
                      Hasta
                      <input
                        type="date"
                        value={draftDateRange.to}
                        min={draftDateRange.from || undefined}
                        onChange={(event) => setDraftDateRange((range) => ({ ...range, to: event.target.value }))}
                        className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  </div>
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setDraftDateRange({ from: '', to: '' })
                        setDateRange({ from: '', to: '' })
                        setShowDateRange(false)
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                    >
                      Limpiar
                    </button>
                    <button
                      type="button"
                      disabled={!draftDateRange.from || !draftDateRange.to}
                      onClick={() => {
                        setDateRange(draftDateRange)
                        setShowDateRange(false)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                      Aplicar rango
                    </button>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-5 pb-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {inf.fecha}
                  </span>
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    {inf.id === 'inf-001' ? 'Excel' : `${inf.paginas} páginas`}
                  </span>
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  {inf.id === 'inf-001' && (
                    <button
                      type="button"
                      onClick={() => setShowDateRange((open) => !open)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition shadow-sm"
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      {dateRange.from && dateRange.to ? 'Rango aplicado' : 'Rango de fechas'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={inf.id === 'inf-001' ? descargarInformeFaltaUnAno : undefined}
                    disabled={inf.id === 'inf-001' && downloading}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1e3a8a] hover:bg-[#172554] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold transition shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {inf.id === 'inf-001' ? (downloading ? 'Generando...' : 'Descargar Excel') : 'Descargar PDF'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
