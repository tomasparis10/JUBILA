# Actualización Masiva desde Excel

## Problema Actual
El `bulkSyncAgentes` anterior consultaba directo la tabla `CARRERA_ADMINISTRATIVA` de la DB y creó 17k registros solo con DNI. Eso se va a reemplazar completamente.

## Nuevo Enfoque
Leer **dos archivos Excel** guardados manualmente en la carpeta `data/` del proyecto:
- `DatosPersonales.xls` → actualiza `DATOS_PERSONALES_AGENTE_JUBILA`
- `CarreraAdministrativa.xls` → actualiza `CARRERA_ADMINISTRATIVA`

---

## User Review Required

> [!IMPORTANT]
> **El archivo `DatosPersonales.xls` está corrupto.** Es un frameset HTML de Excel que referencia `DatosPersonales_archivos/sheet001.htm`, pero esa carpeta no existe en el proyecto. Solo tiene 1 fila de navegación, sin datos.
>
> **Acción necesaria:** Necesitás volver a exportar el reporte de DatosPersonales y pegarlo de nuevo en la carpeta del proyecto. Asegurate de guardarlo como `.xls` o `.xlsx` real (no como "Página web de un solo archivo"). En SQL Server Management Studio, al ejecutar la query, hacé clic derecho → "Save Results As..." y guardarlo como CSV, o exportarlo a Excel directamente.

> [!IMPORTANT]  
> **Decisión: ¿Un botón o dos?**  
> Recomiendo **un solo botón** que procese ambos Excel en secuencia:
> 1. Primero los datos personales (para que el agente exista por DNI)
> 2. Luego la carrera administrativa (que referencia al agente por DNI)
>
> Esto evita errores de orden y simplifica la UX. El resultado mostrará dos secciones separadas en el reporte (una para datos personales y otra para carrera).

---

## Formato de los Excel

### DatosPersonales (fila 1 = "Consulta Externa", fila 2 = headers)
| Campo Excel | Campo DB |
|---|---|
| NOMBRE_REGIMEN | → Buscar `ID_REGIMEN_JUBILATORIO` en tabla `REGIMEN_JUBILATORIO` |
| DNI_AGENTE | `DNI_AGENTE` (clave única) |
| NOMBRE_AGENTE | `NOMBRE_AGENTE` |
| APELLIDO_AGENTE | `APELLIDO_AGENTE` |
| FECHA_NACIMIENTO | `FECHA_NACIMIENTO` |
| SECRETARIA | `SECRETARIA` |
| PROGRAMA | `PROGRAMA` |
| CARGO | `CARGO` |
| SEXO | `SEXO` |
| ESTADO_ACTIVO | `ESTADO_ACTIVO` (mapear "ACTIVO"→true / otro→false) |
| CUIL | `CUIL` |
| NUMERO_TELEFONO | `NUMERO_TELEFONO` |
| CORREO_ELECTRONICO | `CORREO_ELECTRONICO` |

### CarreraAdministrativa (fila 1 = "Consulta Externa", fila 2 = headers)
| Campo Excel | Campo DB |
|---|---|
| EMPLEADO | `DOCUMENTO_EMPLEADO` (referencia a DNI) |
| CAUSA BAJA | `CAUSA_BAJA` |
| FECHA ALTA | `FECHA_ALTA` (viene como Excel serial → convertir a Date) |
| FECHA BAJA | `FECHA_BAJA` (viene como string dd/mm/yyyy o vacío) |

> Los campos `ternro`, `APELLIDO`, `NOMBRE`, `ESTADO` y `CAUSA` (numérica) del Excel de carrera no se guardan en la DB.

---

## Proposed Changes

### Dependencia nueva: `xlsx`
Se necesita instalar `xlsx` como dependencia (ya está instalada como `--no-save`, la agregaremos al `package.json`).

---

### API Route (en vez de Server Action)
#### [NEW] `app/api/bulk-sync/route.ts`
Server Actions no pueden leer archivos del filesystem del servidor de forma eficiente con archivos grandes (36MB). Usaremos una **API Route** que:
1. Lee los Excel desde `data/DatosPersonales.xls` y `data/CarreraAdministrativa.xls`
2. Parsea con `xlsx`
3. Compara contra la DB
4. Inserta/actualiza los registros
5. Retorna un JSON con el diff detallado

**Lógica:**
- **Datos Personales:**
  - Para cada fila del Excel, buscar por `DNI_AGENTE`
  - Si **no existe** → INSERT con todos los campos → marcar como "NUEVO"
  - Si **existe** → comparar cada campo → si alguno cambió → UPDATE solo los campos que cambiaron → marcar diffs
  - Los campos calculados (`ANTIGUEDAD_RECIBO`, `ANTIGUEDAD_LICENCIAS`, `FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA`, `EDAD_ESTIMACION_JUBILACION`) NO se tocan desde el Excel

- **Carrera Administrativa:**
  - Para cada fila del Excel, buscar por `DOCUMENTO_EMPLEADO` + `FECHA_ALTA`
  - Si **no existe** → INSERT → marcar como "NUEVO"
  - Si **existe** → comparar `FECHA_BAJA` y `CAUSA_BAJA` → si cambiaron → UPDATE → marcar diffs

---

### Mover Excel a carpeta `data/`
#### [NEW] `data/` (directorio)
Mover `DatosPersonales.xls` y `CarreraAdministrativa.xls` a `data/`.

---

### Modificar `operaciones-panel.tsx`
#### [MODIFY] `components/operaciones-panel.tsx`
Reemplazar la función `ActualizacionMasiva`:
- Remover la llamada a `bulkSyncAgentes()` del server action
- Agregar llamada `fetch('/api/bulk-sync', { method: 'POST' })`
- Mostrar resultado con **dos secciones separadas**: "Datos Personales" y "Carrera Administrativa"
- En cada sección mostrar:
  - **Registros nuevos**: lista de DNI + nombre con todos sus datos
  - **Registros actualizados**: lista de DNI + nombre con solo los campos que cambiaron (valor anterior → valor nuevo)
  - Contadores: Nuevos / Actualizados / Sin cambios / Errores
- Fecha de última actualización

---

### Eliminar `bulkSyncAgentes` de `agentes.ts`
#### [MODIFY] `app/actions/agentes.ts`
Eliminar la función `bulkSyncAgentes` que ya no se usa.

---

## Verificación

### Manual
1. Re-exportar `DatosPersonales.xls` correctamente y colocarlo en `data/`
2. Ejecutar la actualización masiva desde el panel de Operaciones
3. Verificar que los agentes nuevos aparezcan en la búsqueda del Panel Principal
4. Verificar que los datos cambiados se reflejen correctamente
5. Verificar que la carrera administrativa se cargue y los cálculos de antigüedad funcionen
