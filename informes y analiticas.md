# 📊 Documentación Técnica y Funcional: Pestaña de Informes y Analíticas

**Sistema:** Sistema de Gestión Previsional Municipal (`JUBILA`)  
**Módulo:** `Informes y Analíticas` (`components/informes-analiticas.tsx`)  
**Fecha de corte de datos:** 12/08/2026  

---

## 1. Visión General del Módulo

La pestaña de **Informes y Analíticas** centraliza los indicadores clave de rendimiento (KPIs), la distribución demográfica y administrativa, y el repositorio de documentos e informes ejecutivos del padrón de jubilaciones municipales.

Su objetivo es ofrecer al personal de Recursos Humanos y autoridades previsionales:
1. **Visibilidad global e instantánea** del estado de los 847 expedientes activos.
2. **Alertas operativas tempranas** (vencimientos de invalidez provisoria, suspensiones bajo Art. 43, trámites pendientes).
3. **Distribución sectorial y por beneficio** para la toma de decisiones presupuestarias y de planta de personal.
4. **Centro de descargas** de informes oficiales en formato PDF.

---

## 2. Sección 1: Tarjetas de Métricas Clave (KPIs)

En la parte superior se presentan **6 tarjetas de métricas cuantitativas**. Cada una cuenta con su valor consolidado, comparativa temporal (*delta*), icono representativo y código cromático de estado.

```text
┌──────────────────────────┬──────────────────────────┬──────────────────────────┐
│ Total Jubilaciones (847) │      Pasividad (324)     │  Trámites Pendientes (53)│
│       [ +12 vs mes ]     │      [ +8 nuevas ]       │     [ -5 vs semana ]     │
├──────────────────────────┼──────────────────────────┼──────────────────────────┤
│   Suspensiones Art.43(19)│   Edad Promedio (63.4)   │ Renov. Provisorias (112) │
│       [ +2 nuevas ]      │   [ +0.3 años prom. ]    │     [ -7 vs trim. ]      │
└──────────────────────────┴──────────────────────────┴──────────────────────────┘
```

### Detalle de cada KPI y Metodología de Cálculo:

| KPI | Valor Actual | Variación (*Delta*) | Significado Previsional / Operativo | Cómo se calcula / Origen del dato |
| :--- | :---: | :---: | :--- | :--- |
| **Total Jubilaciones Activas** | `847` | `+12` *(vs mes anterior)* | Total de agentes con legajos jubilatorios vigentes en el municipio. | Conteo total de registros con `estadoActivo: true` en la base de datos de legajos. |
| **En Pasividad** | `324` | `+8` *(nuevas este mes)* | Agentes en régimen de Pasividad Anticipada (PAV/Convenio). | Filtro de expedientes con `beneficio: 'Pasividad'` o con convenio vigente (`fInicioPasividad` cargada). |
| **Trámites Pendientes** | `53` | `-5` *(vs semana anterior)* | Expedientes iniciados en proceso de dictamen o pase a Caja Provincial. | Registros que tienen expediente municipal abierto sin resolución definitiva de baja/otorgamiento. |
| **Con Suspensiones Art. 43** | `19` | `+2` *(nuevas este mes)* | Beneficios retenidos preventivamente por falta de supervivencia o incompatibilidad. | Conteo de agentes con el campo `notificacionArt43` activo o con `nExpArt43SuspPago` consignado. |
| **Edad Promedio** | `63.4` | `+0.3` *(años promedio)* | Edad media de la población pasiva y en trámite. | Promedio aritmético de las edades calculadas en base a la `fechaNacimiento` de cada agente. |
| **Renovaciones Provisorias** | `112` | `-7` *(vs trim. anterior)* | Beneficios de Invalidez Provisoria que requieren junta médica periódica. | Conteo de agentes cuya asignación actual está sujeta a `renovaciones` con fecha de vencimiento (`fechaHastaExp`). |

---

## 3. Sección 2: Gráficos y Analíticas Visuales

La fila intermedia presenta **tres paneles analíticos** diseñados para cruzar variables clave:

### 3.1. Distribución por Tipo de Beneficio
* **Objetivo:** Mostrar qué proporción del padrón corresponde a cada encuadre legal.
* **Tipo de Gráfico:** Barras horizontales proporcionales con porcentajes y totales absolutos.
* **Universo:** $N = 847$ beneficios.

| Beneficio | Casos (Count) | Proporción (%) | Color de Representación |
| :--- | :---: | :---: | :--- |
| **Jubilación Ordinaria** | `356` | `42%` | Azul Real (`#1d4ed8`) |
| **Invalidez Provisoria** | `203` | `24%` | Violeta (`#7c3aed`) |
| **Pasividad Anticipada** | `152` | `18%` | Esmeralda (`#059669`) |
| **Jubilación por Edad Avanzada** | `85` | `10%` | Ámbar (`#d97706`) |
| **Otros Beneficios** | `51` | `6%` | Rojo (`#dc2626`) |

> **Cómo se construyó:**  
> Se totalizan los registros agrupados por tipo de beneficio. Cada barra se renderiza mediante un contenedor de fondo `bg-slate-100` y una barra interna con ancho porcentual dinámico `style={{ width: `${item.pct}%` }}` animada con transiciones CSS (`transition-all duration-700`).

---

### 3.2. Evolución Mensual de Trámites (Último Semestre)
* **Objetivo:** Comparar el ritmo de ingreso de nuevos expedientes vs. la tasa de resolución/cierre por mes.
* **Tipo de Gráfico:** Gráfico de columnas bicolores agrupadas (Marzo a Agosto).
* **Escala Máxima:** Normalizada a `50` trámites mensuales.

```text
Volumen
  50 ┤
  40 ┤             █                Nuevos (Azul: #1d4ed8)
  30 ┤     █       █   █  ░         Cerrados (Verde: emerald-500)
  20 ┤ █ ░ █ ░ ░ █ █ ░ █  ░
  10 ┤ █ ░ █ ░ █ █ █ ░ █  ░ █ ░
   0 ┴───┴───┴───┴───┴───┴───┴──
      Mar Abr May Jun Jul Ago
```

* **Valores del Período:**
  * **Marzo:** 28 nuevos / 21 cerrados
  * **Abril:** 34 nuevos / 18 cerrados
  * **Mayo:** 22 nuevos / 30 cerrados *(mayor eficiencia de resolución)*
  * **Junio:** 41 nuevos / 25 cerrados *(pico de nuevas solicitudes)*
  * **Julio:** 37 nuevos / 33 cerrados
  * **Agosto (en curso):** 12 nuevos / 9 cerrados

> **Cómo se construyó:**  
> Cada mes cuenta con dos columnas verticales continuas con altura porcentual calculada en base a la constante `MAX_MONTHLY`:  
> `height: (m.nuevos / MAX_MONTHLY) * 100%` y `height: (m.cerrados / MAX_MONTHLY) * 100%`. Poseen tooltips nativos (`title`) y efecto `hover:opacity-100` para interactividad.

---

### 3.3. Distribución por Secretaría
* **Objetivo:** Identificar qué áreas municipales originan el mayor volumen de trámites jubilatorios para planificación de reemplazos y concursos de personal.
* **Tipo de Gráfico:** Grilla bidireccional (2 columnas) con barras de progreso segmentadas.

| Secretaría Municipal | Cantidad | % del Total | Color Identificador |
| :--- | :---: | :---: | :--- |
| **Secretaría de Salud** | `262` | `31%` | Azul (`#1d4ed8`) |
| **Secretaría de Educación** | `237` | `28%` | Violeta (`#7c3aed`) |
| **Secretaría de Obras Públicas** | `144` | `17%` | Esmeralda (`#059669`) |
| **Secretaría General** | `110` | `13%` | Ámbar (`#d97706`) |
| **Otras Secretarías / Entes** | `94` | `11%` | Gris Neutro (`#6b7280`) |

---

## 4. Sección 3: Repositorio de Informes Oficiales

En la sección inferior se dispone una cuadrícula con los **4 informes oficiales generados por el sistema**, listos para consulta y descarga en formato PDF.

```text
┌────────────────────────────────────────┬────────────────────────────────────────┐
│ [PDF] Informe Mensual de Jubilaciones  │ [PDF] Reporte de Vencimientos Provis.  │
│ Tipo: Mensual | 14 Págs | 12/08/2026   │ Tipo: Operativo | 8 Págs | 01/08/2026  │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ [PDF] Estadísticas Anuales 2025        │ [PDF] Informe de Suspensiones Art. 43  │
│ Tipo: Anual | 32 Págs | 15/01/2026     │ Tipo: Operativo | 5 Págs | 08/08/2026  │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

### Fichas Técnicas de los Documentos:

1. **Informe Mensual de Jubilaciones** (`inf-001`)
   * **Tipo:** Ejecutivo / Mensual *(14 páginas)*
   * **Contenido:** Resumen consolidado de altas, bajas, modificaciones de haber provisorio y dictámenes aprobados durante el período corriente.
   * **Destinatarios:** Dirección de Recursos Humanos y Secretaría de Finanzas.

2. **Reporte de Vencimientos Provisorios** (`inf-002`)
   * **Tipo:** Operativo / Control de Gestión *(8 páginas)*
   * **Contenido:** Nómina nominalizada de agentes con Invalidez Provisoria cuyos plazos de revisión médica vencen en los próximos 60 días para turno ante Junta Médica.
   * **Destinatarios:** Área de Medicina Laboral y Juntas Evaluadoras.

3. **Estadísticas Anuales 2025** (`inf-003`)
   * **Tipo:** Histórico / Anual *(32 páginas)*
   * **Contenido:** Balance global anual: promedios de antigüedad de retiro, desglose por categorías, impacto financiero y pirámide etaria del municipio.
   * **Destinatarios:** Intendencia Municipal y Concejo Deliberante.

4. **Informe de Suspensiones Art. 43** (`inf-004`)
   * **Tipo:** Legal / Operativo *(5 páginas)*
   * **Contenido:** Nómina de pagos retenidos preventivamente conforme al Art. 43 de la Ordenanza Previsional, detalle de causas e intimaciones cursadas.
   * **Destinatarios:** Asesoría Letrada y Liquidación de Haberes.

---

## 5. Arquitectura Técnica y Construcción en Código

El módulo fue implementado con los siguientes estándares de ingeniería de software:

* **Framework:** React 18 + Next.js (App Router, directiva `'use client'`).
* **Componente principal:** `components/informes-analiticas.tsx`.
* **Iconografía:** `lucide-react` (`BarChart2`, `Users`, `CheckCircle2`, `Clock`, `AlertTriangle`, `TrendingUp`, `TrendingDown`, `Download`, `Shield`, `FileBarChart`, etc.).
* **Sistema de Estilos:** Tailwind CSS con paleta institucional (`#1e3a8a` Azul Municipal, `#172554` Navy profundo, esmeraldas, ámbar y rosas semánticos).
* **Estructura de Datos:** Modelos fuertemente tipados en TypeScript (`KPI_DATA`, `BENEFICIO_DIST`, `MONTHLY_EVOLUTION`, `SECRETARIA_DATA`, `INFORMES_CARDS`).
* **Accesibilidad y Responsividad:**
  * Grilla adaptable: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`.
  * Tarjetas con acento lateral (*left border accent*) para jerarquía visual.
  * Etiquetas de datos y estados con badges redondeados de alto contraste.
