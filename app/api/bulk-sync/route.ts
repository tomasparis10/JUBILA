import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '@/lib/prisma'

interface DiffField { campo: string; anterior: string; nuevo: string }

interface AgenteNuevo {
  dni: string; nombre: string; apellido: string; secretaria: string
  programa: string; cargo: string; sexo: string; estadoActivo: boolean
  cuil: string; telefono: string; correo: string; fechaNacimiento: string
}

interface AgenteActualizado { dni: string; nombre: string; diffs: DiffField[] }
interface CarreraNueva { dni: string; fechaAlta: string; fechaBaja: string; causaBaja: string }
interface CarreraActualizada { dni: string; fechaAlta: string; diffs: DiffField[] }

function excelSerialToDate(serial: number): Date {
  const epoch = new Date(1899, 11, 30)
  epoch.setDate(epoch.getDate() + serial)
  return epoch
}

function parseExcelDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'number') return excelSerialToDate(value)
  if (typeof value === 'string') {
    const s = value.trim()
    if (!s) return null
    const parts = s.split('/')
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts
      const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`)
      return isNaN(d.getTime()) ? null : d
    }
  }
  return null
}

function dateToStr(d: Date | null | undefined): string {
  if (!d) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}/${d.getFullYear()}`
}

function norm(v: unknown): string { return String(v ?? '').trim() }

function nowStr(): string {
  const now = new Date()
  return `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`
}

function readExcel(filename: string): Record<string, unknown>[] {
  const filePath = path.join(process.cwd(), 'data', filename)
  if (!fs.existsSync(filePath)) throw new Error(`Archivo no encontrado: data/${filename}`)
  // Usamos readFileSync + XLSX.read para evitar problemas con rutas con caracteres especiales
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { defval: '', header: 1 }) as unknown[][]
  if (raw.length < 2) return []
  const headers = (raw[1] as unknown[]).map((h) => String(h ?? '').trim())
  const rows: Record<string, unknown>[] = []
  for (let i = 2; i < raw.length; i++) {
    const row = raw[i] as unknown[]
    const obj: Record<string, unknown> = {}
    headers.forEach((h, idx) => { obj[h] = row[idx] ?? '' })
    rows.push(obj)
  }
  return rows
}

async function processDatosPersonales() {
  const rows = readExcel('DatosPersonales.xlsx')
  const regimenes = await prisma.rEGIMEN_JUBILATORIO.findMany({
    select: { ID_REGIMEN_JUBILATORIO: true, NOMBRE_REGIMEN: true },
  })
  const nuevos: AgenteNuevo[] = []
  const actualizados: AgenteActualizado[] = []
  let sinCambios = 0; let errores = 0; const errorDetails: string[] = []

  for (const row of rows) {
    const dni = norm(row['DNI_AGENTE'])
    if (!dni) continue
    try {
      const nombreRegimen = norm(row['NOMBRE_REGIMEN'])
      let idRegimen: number | null = null
      if (nombreRegimen) {
        const reg = regimenes.find((r) => r.NOMBRE_REGIMEN.trim().toLowerCase() === nombreRegimen.toLowerCase())
        idRegimen = reg?.ID_REGIMEN_JUBILATORIO ?? null
      }
      const estadoActivo = norm(row['ESTADO_ACTIVO']).toUpperCase() === 'ACTIVO'
      const fechaNac = parseExcelDate(row['FECHA_NACIMIENTO'])
      const nombre = norm(row['NOMBRE_AGENTE'])
      const apellido = norm(row['APELLIDO_AGENTE'])
      const secretaria = norm(row['SECRETARIA']) || null
      const programa = norm(row['PROGRAMA']) || null
      const cargo = norm(row['CARGO']) || null
      const sexo = norm(row['SEXO']) || null
      const cuil = norm(row['CUIL']) || null
      const telefono = norm(row['NUMERO_TELEFONO']) || null
      const correo = norm(row['CORREO_ELECTRONICO']) || null

      const existente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({ where: { DNI_AGENTE: dni } })

      if (!existente) {
        if (!fechaNac) { errores++; errorDetails.push(`DNI ${dni}: fecha de nacimiento invalida`); continue }
        await prisma.dATOS_PERSONALES_AGENTE_JUBILA.create({
          data: { DNI_AGENTE: dni, NOMBRE_AGENTE: nombre, APELLIDO_AGENTE: apellido, FECHA_NACIMIENTO: fechaNac, SECRETARIA: secretaria, PROGRAMA: programa, CARGO: cargo, SEXO: sexo, ESTADO_ACTIVO: estadoActivo, CUIL: cuil, NUMERO_TELEFONO: telefono, CORREO_ELECTRONICO: correo, ID_REGIMEN_JUBILATORIO: idRegimen },
        })
        nuevos.push({ dni, nombre, apellido, secretaria: secretaria ?? '', programa: programa ?? '', cargo: cargo ?? '', sexo: sexo ?? '', estadoActivo, cuil: cuil ?? '', telefono: telefono ?? '', correo: correo ?? '', fechaNacimiento: dateToStr(fechaNac) })
      } else {
        const diffs: DiffField[] = []
        const check = (campo: string, anterior: string, nuevo: string) => { if (anterior.trim() !== nuevo.trim()) diffs.push({ campo, anterior, nuevo }) }
        check('NOMBRE_AGENTE', norm(existente.NOMBRE_AGENTE), nombre)
        check('APELLIDO_AGENTE', norm(existente.APELLIDO_AGENTE), apellido)
        check('FECHA_NACIMIENTO', dateToStr(existente.FECHA_NACIMIENTO), dateToStr(fechaNac))
        check('SECRETARIA', norm(existente.SECRETARIA), norm(secretaria))
        check('PROGRAMA', norm(existente.PROGRAMA), norm(programa))
        check('CARGO', norm(existente.CARGO), norm(cargo))
        check('SEXO', norm(existente.SEXO), norm(sexo))
        check('ESTADO_ACTIVO', String(existente.ESTADO_ACTIVO), String(estadoActivo))
        check('CUIL', norm(existente.CUIL), norm(cuil))
        check('NUMERO_TELEFONO', norm(existente.NUMERO_TELEFONO), norm(telefono))
        check('CORREO_ELECTRONICO', norm(existente.CORREO_ELECTRONICO), norm(correo))
        if (diffs.length > 0) {
          const updateData: Record<string, unknown> = {}
          for (const d of diffs) {
            if (d.campo === 'NOMBRE_AGENTE') updateData.NOMBRE_AGENTE = nombre
            if (d.campo === 'APELLIDO_AGENTE') updateData.APELLIDO_AGENTE = apellido
            if (d.campo === 'FECHA_NACIMIENTO') updateData.FECHA_NACIMIENTO = fechaNac
            if (d.campo === 'SECRETARIA') updateData.SECRETARIA = secretaria
            if (d.campo === 'PROGRAMA') updateData.PROGRAMA = programa
            if (d.campo === 'CARGO') updateData.CARGO = cargo
            if (d.campo === 'SEXO') updateData.SEXO = sexo
            if (d.campo === 'ESTADO_ACTIVO') updateData.ESTADO_ACTIVO = estadoActivo
            if (d.campo === 'CUIL') updateData.CUIL = cuil
            if (d.campo === 'NUMERO_TELEFONO') updateData.NUMERO_TELEFONO = telefono
            if (d.campo === 'CORREO_ELECTRONICO') updateData.CORREO_ELECTRONICO = correo
          }
          if (idRegimen !== null) updateData.ID_REGIMEN_JUBILATORIO = idRegimen
          await prisma.dATOS_PERSONALES_AGENTE_JUBILA.update({ where: { DNI_AGENTE: dni }, data: updateData })
          actualizados.push({ dni, nombre: `${apellido} ${nombre}`.trim(), diffs })
        } else { sinCambios++ }
      }
    } catch (err) { errores++; errorDetails.push(`DNI ${dni}: ${String(err)}`) }
  }
  return { nuevos, actualizados, sinCambios, errores, errorDetails }
}

async function processCarreraAdministrativa() {
  const rows = readExcel('CarreraAdministrativa.xlsx')
  const nuevas: CarreraNueva[] = []
  const actualizadas: CarreraActualizada[] = []
  let sinCambios = 0; let errores = 0; const errorDetails: string[] = []

  for (const row of rows) {
    const dni = norm(row['EMPLEADO'])
    if (!dni) continue
    try {
      const fechaAlta = parseExcelDate(row['FECHA ALTA'])
      const fechaBaja = parseExcelDate(row['FECHA BAJA'])
      const causaBaja = norm(row['CAUSA BAJA']) || null
      if (!fechaAlta) { errores++; errorDetails.push(`DNI ${dni}: FECHA ALTA invalida`); continue }

      const agente = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findUnique({ where: { DNI_AGENTE: dni }, select: { DNI_AGENTE: true } })
      if (!agente) { errores++; errorDetails.push(`DNI ${dni}: agente no encontrado`); continue }

      const fechaAltaStart = new Date(fechaAlta); fechaAltaStart.setHours(0,0,0,0)
      const fechaAltaEnd = new Date(fechaAlta); fechaAltaEnd.setHours(23,59,59,999)
      const existente = await prisma.cARRERA_ADMINISTRATIVA.findFirst({ where: { DOCUMENTO_EMPLEADO: dni, FECHA_ALTA: { gte: fechaAltaStart, lte: fechaAltaEnd } } })

      if (!existente) {
        await prisma.cARRERA_ADMINISTRATIVA.create({ data: { DOCUMENTO_EMPLEADO: dni, FECHA_ALTA: fechaAlta, FECHA_BAJA: fechaBaja, CAUSA_BAJA: causaBaja } })
        nuevas.push({ dni, fechaAlta: dateToStr(fechaAlta), fechaBaja: dateToStr(fechaBaja), causaBaja: causaBaja ?? '' })
      } else {
        const diffs: DiffField[] = []
        if (dateToStr(existente.FECHA_BAJA) !== dateToStr(fechaBaja)) diffs.push({ campo: 'FECHA_BAJA', anterior: dateToStr(existente.FECHA_BAJA), nuevo: dateToStr(fechaBaja) })
        if (norm(existente.CAUSA_BAJA) !== norm(causaBaja)) diffs.push({ campo: 'CAUSA_BAJA', anterior: norm(existente.CAUSA_BAJA), nuevo: norm(causaBaja) })
        if (diffs.length > 0) {
          await prisma.cARRERA_ADMINISTRATIVA.update({ where: { ID_CARRERA: existente.ID_CARRERA }, data: { FECHA_BAJA: fechaBaja, CAUSA_BAJA: causaBaja } })
          actualizadas.push({ dni, fechaAlta: dateToStr(fechaAlta), diffs })
        } else { sinCambios++ }
      }
    } catch (err) { errores++; errorDetails.push(`DNI ${dni}: ${String(err)}`) }
  }
  return { nuevas, actualizadas, sinCambios, errores, errorDetails }
}

export async function POST() {
  try {
    const [dpResult, caResult] = await Promise.allSettled([processDatosPersonales(), processCarreraAdministrativa()])
    const lastUpdated = nowStr()
    const dpData = dpResult.status === 'fulfilled' ? dpResult.value : { nuevos: [], actualizados: [], sinCambios: 0, errores: 1, errorDetails: [String((dpResult as PromiseRejectedResult).reason)] }
    const caData = caResult.status === 'fulfilled' ? caResult.value : { nuevas: [], actualizadas: [], sinCambios: 0, errores: 1, errorDetails: [String((caResult as PromiseRejectedResult).reason)] }
    return NextResponse.json({ ok: true, lastUpdated, datosPersonales: dpData, carreraAdministrativa: caData })
  } catch (err) {
    console.error('[bulk-sync] Error:', err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
