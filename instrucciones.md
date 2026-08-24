# Contexto y Objetivo
Actúa como un desarrollador Senior experto en Next.js (App Router), TypeScript y Prisma ORM con SQL Server.

He creado nuevas tablas en mi base de datos real (SQL Server) y necesito conectar mi frontend maquetado con esta información mediante Server Actions o Route Handlers. Las dos tablas nuevas principales son:
1. `CARRERA_ADMINISTRATIVA`: Historial de fases de los empleados (`DOCUMENTO_EMPLEADO`, `FECHA_ALTA`, `FECHA_BAJA`, `CAUSA_BAJA`).
2. `ARCHIVO_JUBILACION`: Almacenamiento de documentos adjuntos (`ID_ARCHIVO`, `ID_JUBILA`, `NOMBRE_ARCHIVO`, `TIPO_ARCHIVO`, `DATOS_ARCHIVO`, `FECHA_SUBIDA`, `USUARIO_SUBIDA`).

**Objetivo:** Actualizar el esquema de Prisma, crear las utilidades de cálculos previsionales, e implementar un sistema de subida y visualización de archivos en el frontend.

---

# Plan de Ejecución Estricto (Paso a Paso)

## 1. Actualización del Esquema Prisma
* Indícame cómo ejecutar la introspección (`prisma db pull`) para traer las nuevas tablas.
* Guíame para establecer las relaciones:
  - `DATOS_PERSONALES_AGENTE_JUBILA` (1) a `CARRERA_ADMINISTRATIVA` (N) mediante DNI/Documento.
  - `JUBILA` (1) a `ARCHIVO_JUBILACION` (N) mediante `ID_JUBILA`.
* Ten en cuenta que `DATOS_ARCHIVO` en SQL Server suele ser `VARBINARY(MAX)`, por lo que en Prisma se mapeará como `Bytes`.

## 2. Lógica de Cálculos (Backend / Utils)
Crea un archivo `utils/calculosPrevisionales.ts` con funciones que reciban el array de fases del agente y devuelvan:
* **A. Antigüedad Recibo (Total a hoy):** Sumar la diferencia en días entre `FECHA_ALTA` y `FECHA_BAJA` de cada fase. Si `FECHA_BAJA` es `null`, usar la fecha actual. Formatear como `"X Años, Y Meses, Z Días"` (años de 365 días, meses de 30).
* **B. Antigüedad Licencias (Corte al 31/12/2025):** Igual al anterior, pero limitando el cálculo: si una fase terminó en 2026 o sigue activa, su `FECHA_BAJA` temporal para este cálculo debe ser estrictamente `2025-12-31`. Fases iniciadas en 2026 se ignoran. Formato: `"X Años, Y Meses, Z Días"`.
* **C. Fecha Estimada de Jubilación:** Cruzar la `FECHA_NACIMIENTO` del agente con la `EDAD_REQUERIDA` de su `REGIMEN_JUBILATORIO`. Retornar la fecha exacta en la que cumple esa edad.

## 3. Gestión de Archivos Adjuntos (Frontend y Backend)
Debes implementar dos funcionalidades en la página principal para el registro de Jubilación:

**A. Botón "Cargar PDF/Imágenes" (Upload):**
* **Frontend:** Input oculto o área de drag & drop. Debe validar extensión (`.pdf`, `.jpg`, `.jpeg`, `.png`), tamaño máximo (10 MB por archivo) y límite de envíos (Máximo 5 archivos por vez).
* **Backend (Server Action):** Recibir los archivos (`FormData`), validar nuevamente tipo y peso por seguridad, convertir el archivo a `Buffer` y guardarlo en la base de datos dentro del campo `DATOS_ARCHIVO`.

**B. Sección "Ver PDF/Imágenes" (Visualizador In-App):**
* Mostrar una tabla o lista con los archivos pertenecientes al `ID_JUBILA` actual (extrayendo `NOMBRE_ARCHIVO`, `FECHA_SUBIDA`, etc., pero excluyendo el peso del buffer en la primera consulta para no saturar la red).
* Al hacer clic en un archivo, hacer un fetch del buffer (`DATOS_ARCHIVO`), convertirlo a base64 o Blob URL y abrir un **Modal visor**.
* El modal debe usar un `<iframe src={blobUrl} />` si es PDF, o una etiqueta `<img src={blobUrl} />` si es imagen. No debe forzar la descarga directa, solo visualización In-App.

## 4. Regla Estricta: CERO MOCKS
* **PROHIBICIÓN DE DATOS MOCKEADOS:** Queda absolutamente prohibido usar datos estáticos. Si un agente no tiene fases, la antigüedad es 0. Si no hay archivos, la tabla de adjuntos muestra "No hay documentos". Usa estados de carga (`loading`) y manejo de errores reales.

Por favor, confirma que entendiste todas las reglas y dime cuál es el primer archivo que vamos a modificar o crear.