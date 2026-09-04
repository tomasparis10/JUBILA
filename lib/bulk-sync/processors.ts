/**
 * lib/bulk-sync/processors.ts
 *
 * Análisis en memoria (ZERO side-effects sobre la DB).
 *
 * Recibe filas del Excel + datos actuales de la DB y produce
 * listas de operaciones pendientes (inserts, updates, errores).
 *
 * REGLAS ABSOLUTAS:
 * - NO ejecutar ninguna query de escritura aquí
 * - NO adivinar ante datos ambiguos → marcar como error
 * - NO borrar registros
 * - NO sobreescribir campos calculados (ANTIGUEDAD_*, FECHA_ESTIMADA_*, EDAD_*)
 */

import {
  normalizeDni,
  normalizeSexo,
  normalizeDate,
  normalizeEstadoActivo,
  dateToStr,
  normStr,
  isIrrationalAltaDate,
} from './normalizers'
import { resolveRegimenId, calcFechaEstimada, calcEdadActual } from './resolvers'
import { getCol } from './validators'
import type {
  AgenteExistente,
  FaseExistente,
  RegimenRow,
  AnalysisResult,
  DpRowNueva,
  DpRowActualizada,
  DpRowError,
  DiffField,
  CaRowNueva,
  CaRowActualizada,
  CaRowError,
} from './types'

// ─────────────────────────────────────────────────────────────────────────────
// Análisis de Datos Personales
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza las filas del Excel de DatosPersonales contra los registros
 * actuales de la DB y produce las operaciones pendientes.
 *
 * @param rows - Filas del Excel (normalizadas por readExcelBuffer)
 * @param regimenes - Todos los regímenes de REGIMEN_JUBILATORIO
 * @param existentes - Map de DNI → registro actual en DATOS_PERSONALES_AGENTE_JUBILA
 */
export function analyzeDatosPersonales(
  rows: Record<string, unknown>[],
  regimenes: RegimenRow[],
  existentes: Map<string, AgenteExistente>,
): {
  nuevas: DpRowNueva[]
  actualizadas: DpRowActualizada[]
  sinCambios: number
  errores: DpRowError[]
  omitidas: number
  sinDni: DpRowError[]
  dnisEnExcel: Set<string>
} {
  const nuevas: DpRowNueva[] = []
  const actualizadas: DpRowActualizada[] = []
  let sinCambios = 0
  const errores: DpRowError[] = []
  let omitidas = 0
  const sinDni: DpRowError[] = []
  const dnisEnExcel = new Set<string>()
  const dnisVistos = new Set<string>()

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2 // 1-indexed, +1 por header
    const archivo = 'DatosPersonales.xlsx'

    // ── Normalizar DNI ──────────────────────────────────────────────────────
    const dniRaw = getCol(row, 'DNI_AGENTE')
    const dni = normalizeDni(dniRaw)

    const dniVacio = !String(dniRaw ?? '').trim()
    if (dniVacio) {
      sinDni.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'DNI_AGENTE',
        valor: '',
        descripcion: `La persona ${String(getCol(row, 'APELLIDO_AGENTE') ?? '').trim()} ${String(getCol(row, 'NOMBRE_AGENTE') ?? '').trim()} no tiene DNI; no se va a cargar.`,
      })
      return
    }
    if (!dni && !dniVacio) {
      errores.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'DNI_AGENTE',
        valor: String(dniRaw ?? ''),
        descripcion: 'DNI vacío o inválido.',
      })
      return
    }

    // ── Detectar duplicados en el Excel ─────────────────────────────────────
    if (dni && dnisVistos.has(dni)) {
      omitidas++
      return
    }
    if (dni) {
      dnisVistos.add(dni)
      dnisEnExcel.add(dni)
    }

    // ── Normalizar sexo ─────────────────────────────────────────────────────
    const sexoRaw = getCol(row, 'SEXO')
    const sexo = normalizeSexo(sexoRaw)

    if (!sexo) {
      errores.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'SEXO',
        valor: String(sexoRaw ?? ''),
        descripcion: 'El valor de SEXO está vacío o no puede determinarse (se esperaba Masculino/Femenino/M/F).',
      })
      return
    }

    // ── Normalizar régimen ──────────────────────────────────────────────────
    const nombreRegimenRaw = getCol(row, 'NOMBRE_REGIMEN')
    const regimenVacio = !String(nombreRegimenRaw ?? '').trim()
    const resolved = resolveRegimenId(nombreRegimenRaw, sexoRaw, regimenes)

    // Si el régimen viene con un valor pero no pudo resolverse → error (dato sucio o desconocido)
    // Si viene vacío (agentes inactivos sin régimen en VISMA) → se acepta como null (campo nullable en DB)
    if (!resolved && !regimenVacio) {
      errores.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'NOMBRE_REGIMEN',
        valor: String(nombreRegimenRaw ?? ''),
        descripcion: `No se pudo determinar el régimen jubilatorio para el valor "${String(nombreRegimenRaw ?? '')}" con sexo "${String(sexoRaw ?? '')}".`,
      })
      return
    }

    const idRegimen = resolved?.id ?? null

    // ── Normalizar fecha de nacimiento ──────────────────────────────────────
    const fechaNacRaw = getCol(row, 'FECHA_NACIMIENTO')
    const fechaNac = normalizeDate(fechaNacRaw)

    if (!fechaNac) {
      errores.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'FECHA_NACIMIENTO',
        valor: String(fechaNacRaw ?? ''),
        descripcion: 'La fecha de nacimiento está vacía o tiene un formato inválido.',
      })
      return
    }

    // ── Otros campos ────────────────────────────────────────────────────────
    const nombre = normStr(getCol(row, 'NOMBRE_AGENTE')) || ''
    const apellido = normStr(getCol(row, 'APELLIDO_AGENTE')) || ''
    const secretaria = String(getCol(row, 'SECRETARIA') ?? '').trim() || null
    const programa = String(getCol(row, 'PROGRAMA') ?? '').trim() || null
    const cargo = String(getCol(row, 'CARGO') ?? '').trim() || null
    const cuil = String(getCol(row, 'CUIL') ?? '').trim() || null
    const telefono = String(getCol(row, 'NUMERO_TELEFONO') ?? '').trim() || null
    const correo = String(getCol(row, 'CORREO_ELECTRONICO') ?? '').trim() || null
    const estadoActivo = normalizeEstadoActivo(getCol(row, 'ESTADO_ACTIVO'))

    // ── Calcular campos derivados ───────────────────────────────────────────
    const regimenRow = regimenes.find((r) => r.ID_REGIMEN_JUBILATORIO === idRegimen)
    const edadRequerida = regimenRow?.EDAD_REQUERIDA ?? null

    // ── Caso A: agente nuevo ────────────────────────────────────────────────
    if (!dni || !existentes.has(dni)) {
      nuevas.push({
        kind: 'insert',
        dni,
        nombre,
        apellido,
        secretaria: secretaria ?? '',
        programa: programa ?? '',
        cargo: cargo ?? '',
        sexo,
        estadoActivo,
        cuil: cuil ?? '',
        telefono: telefono ?? '',
        correo: correo ?? '',
        fechaNacimiento: dateToStr(fechaNac),
        idRegimen,
        fechaNacimientoISO: fechaNac.toISOString(),
      })
      return
    }

    // ── Caso B: agente existente ────────────────────────────────────────────
    const existente = existentes.get(dni)!
    const diffs: DiffField[] = []

    const check = (campo: string, anterior: string, nuevo: string) => {
      // Comparación semántica: null/'' son equivalentes para campos opcionales
      const ant = anterior.trim()
      const nvo = nuevo.trim()
      if (ant !== nvo) {
        diffs.push({ campo, anterior: ant, nuevo: nvo })
      }
    }

    check('NOMBRE_AGENTE', normStr(existente.NOMBRE_AGENTE), nombre)
    check('APELLIDO_AGENTE', normStr(existente.APELLIDO_AGENTE), apellido)
    check('FECHA_NACIMIENTO', dateToStr(existente.FECHA_NACIMIENTO), dateToStr(fechaNac))
    check('SECRETARIA', normStr(existente.SECRETARIA), normStr(secretaria))
    check('PROGRAMA', normStr(existente.PROGRAMA), normStr(programa))
    check('CARGO', normStr(existente.CARGO), normStr(cargo))
    check('SEXO', normStr(existente.SEXO), normStr(sexo))
    check('ESTADO_ACTIVO', String(existente.ESTADO_ACTIVO), String(estadoActivo))
    check('CUIL', normStr(existente.CUIL), normStr(cuil))
    check('NUMERO_TELEFONO', normStr(existente.NUMERO_TELEFONO), normStr(telefono))
    check('CORREO_ELECTRONICO', normStr(existente.CORREO_ELECTRONICO), normStr(correo))

    // Comparar régimen (null vs null = sin cambio)
    const regAnterior = existente.ID_REGIMEN_JUBILATORIO ?? null
    const regNuevo = idRegimen
    if (regAnterior !== regNuevo) {
      const anteriorNombre = regAnterior !== null
        ? (regimenes.find((r) => r.ID_REGIMEN_JUBILATORIO === regAnterior)?.NOMBRE_REGIMEN ?? String(regAnterior))
        : '(sin régimen)'
      const nuevoNombre = resolved?.regimenCanónico ?? '(sin régimen)'
      diffs.push({
        campo: 'REGIMEN_JUBILATORIO',
        anterior: anteriorNombre,
        nuevo: nuevoNombre,
      })
    }

    if (diffs.length > 0) {
      actualizadas.push({
        kind: 'update',
        dni,
        nombre: `${apellido} ${nombre}`.trim(),
        apellido,
        diffs,
        payload: {
          NOMBRE_AGENTE: nombre,
          APELLIDO_AGENTE: apellido,
          FECHA_NACIMIENTO: fechaNac.toISOString(),
          SECRETARIA: secretaria,
          PROGRAMA: programa,
          CARGO: cargo,
          SEXO: sexo,
          ESTADO_ACTIVO: estadoActivo,
          CUIL: cuil,
          NUMERO_TELEFONO: telefono,
          CORREO_ELECTRONICO: correo,
          ID_REGIMEN_JUBILATORIO: idRegimen,
        },
      })
    } else {
      sinCambios++
    }

    void edadRequerida // usado en commit, no aquí
  })

  return { nuevas, actualizadas, sinCambios, errores, omitidas, sinDni, dnisEnExcel }
}

// ─────────────────────────────────────────────────────────────────────────────
// Análisis de Carrera Administrativa
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Analiza las filas del Excel de CarreraAdministrativa contra los registros
 * actuales de la DB y produce las operaciones pendientes.
 *
 * Clave funcional de una fase: DOCUMENTO_EMPLEADO + FECHA_ALTA (mismo día UTC)
 *
 * @param rows - Filas del Excel
 * @param fases - Map de clave → fase existente en CARRERA_ADMINISTRATIVA
 *   La clave es `${dni}|${dateToStr(fechaAlta)}`
 * @param dnisConocidos - Set de DNIs que existen en DATOS_PERSONALES_AGENTE_JUBILA
 */
export function analyzeCarreraAdministrativa(
  rows: Record<string, unknown>[],
  fases: Map<string, FaseExistente[]>,
  dnisConocidos: Set<string>,
): {
  nuevas: CaRowNueva[]
  actualizadas: CaRowActualizada[]
  sinCambios: number
  errores: CaRowError[]
  ignoradas: number
  noEncontradas: CaRowError[]
} {
  const nuevas: CaRowNueva[] = []
  const actualizadas: CaRowActualizada[] = []
  let sinCambios = 0
  const errores: CaRowError[] = []
  let ignoradas = 0
  const noEncontradas: CaRowError[] = []

  rows.forEach((row, idx) => {
    const rowIndex = idx + 2
    const archivo = 'CarreraAdministrativa.xlsx'

    // ── Documento/DNI ───────────────────────────────────────────────────────
    const dniRaw = getCol(row, 'EMPLEADO')
    const dni = normalizeDni(dniRaw)

    if (!dni) {
      errores.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'EMPLEADO',
        valor: String(dniRaw ?? ''),
        descripcion: 'El campo EMPLEADO (documento) está vacío o es inválido.',
      })
      return
    }

    // Mantener la FK Carrera -> DNI: se informa, pero no bloquea otras filas.
    if (!dnisConocidos.has(dni)) {
      noEncontradas.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'EMPLEADO',
        valor: dni,
        descripcion: `El DNI ${dni} no existe en Datos Personales y esta fase no se va a subir.`,
      })
      return
    }

    // ── FECHA ALTA ──────────────────────────────────────────────────────────
    const fechaAltaRaw = getCol(row, 'FECHA ALTA')
    const fechaAlta = normalizeDate(fechaAltaRaw)

    if (!fechaAlta) {
      errores.push({
        kind: 'error',
        rowIndex,
        archivo,
        campo: 'FECHA ALTA',
        valor: String(fechaAltaRaw ?? ''),
        descripcion: 'FECHA ALTA está vacía o tiene un formato inválido.',
      })
      return
    }

    if (isIrrationalAltaDate(fechaAlta)) {
      ignoradas++
      return
    }

    // ── FECHA BAJA ──────────────────────────────────────────────────────────
    const fechaBajaRaw = getCol(row, 'FECHA BAJA')
    const fechaBaja = normalizeDate(fechaBajaRaw) // null si está vacía (fase abierta)

    // ── CAUSA BAJA ──────────────────────────────────────────────────────────
    const causaBaja = String(getCol(row, 'CAUSA BAJA') ?? '').trim() || null

    // ── Clave funcional de la fase ──────────────────────────────────────────
    const claveAlta = dateToStr(fechaAlta)
    const faseClave = `${dni}|${claveAlta}`

    const candidatas = fases.get(faseClave) ?? []
    const existenteExacta = candidatas.find((fase) =>
      dateToStr(fase.FECHA_BAJA) === dateToStr(fechaBaja) &&
      (fase.CAUSA_BAJA ?? '').trim() === (causaBaja ?? '').trim(),
    )

    // Si la misma fase aparece repetida y una de las filas ya coincide,
    // no actualizar contra otra fila de la misma clave funcional.
    if (existenteExacta) {
      sinCambios++
      return
    }

    // ── Caso A: fase nueva ──────────────────────────────────────────────────
    if (candidatas.length === 0) {
      nuevas.push({
        kind: 'insert',
        dni,
        fechaAltaISO: fechaAlta.toISOString(),
        fechaBajaISO: fechaBaja ? fechaBaja.toISOString() : null,
        causaBaja,
        fechaAltaStr: claveAlta,
        fechaBajaStr: dateToStr(fechaBaja),
      })
      return
    }

    // ── Caso B: fase existente ──────────────────────────────────────────────
    const existente = candidatas[0]
    const diffs: DiffField[] = []

    const bajAnt = dateToStr(existente.FECHA_BAJA)
    const bajNvo = dateToStr(fechaBaja)
    if (bajAnt !== bajNvo) {
      diffs.push({ campo: 'FECHA_BAJA', anterior: bajAnt || '—', nuevo: bajNvo || '—' })
    }

    const causaAnt = (existente.CAUSA_BAJA ?? '').trim()
    const causaNvo = (causaBaja ?? '').trim()
    if (causaAnt !== causaNvo) {
      diffs.push({ campo: 'CAUSA_BAJA', anterior: causaAnt || '—', nuevo: causaNvo || '—' })
    }

    if (diffs.length > 0) {
      actualizadas.push({
        kind: 'update',
        idCarrera: existente.ID_CARRERA,
        dni,
        fechaAltaStr: claveAlta,
        diffs,
        payload: {
          FECHA_BAJA: fechaBaja ? fechaBaja.toISOString() : null,
          CAUSA_BAJA: causaBaja,
        },
      })
    } else {
      sinCambios++
    }
  })

  return { nuevas, actualizadas, sinCambios, errores, ignoradas, noEncontradas }
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-exportar helpers de resolvers para uso en commit
// ─────────────────────────────────────────────────────────────────────────────
export { calcFechaEstimada, calcEdadActual }
