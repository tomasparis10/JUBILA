# IMPLEMENTACIÓN DE MÓDULO DE ACTUALIZACIÓN MASIVA DESDE EXCEL — SISTEMA JUBILA

## 1. CONTEXTO GENERAL

Estoy desarrollando un sistema web denominado **JUBILA**, destinado a la gestión de agentes de la Municipalidad que se encuentran próximos a jubilarse o que deben ser gestionados dentro del proceso jubilatorio.

El sistema ya se encuentra desarrollado y funcionando.

Antes de realizar cualquier modificación, primero analizar el proyecto completo y comprender:

- arquitectura actual;
- stack utilizado;
- framework frontend;
- framework/backend utilizado;
- conexión actual a base de datos;
- estructura de servicios;
- endpoints o server actions existentes;
- modelos o tipos existentes;
- componentes visuales existentes;
- sistema de autenticación;
- sistema de permisos;
- forma actual de realizar INSERT, UPDATE y transacciones;
- convenciones de nombres y organización de carpetas.

### Reglas generales

- NO reestructurar innecesariamente el proyecto.
- NO modificar funcionalidades existentes que no estén relacionadas con esta tarea.
- NO cambiar nombres de tablas.
- NO cambiar nombres de columnas existentes.
- NO crear una arquitectura paralela si el proyecto ya tiene patrones definidos.
- Reutilizar componentes, estilos, servicios y patrones existentes.
- Priorizar siempre la integridad de los datos.
- Ante datos ambiguos o desconocidos, NO adivinar.

---

# 2. OBJETIVO

Implementar dentro del sistema(en operaciones - Carga Masiva, donde ya hay una logica hecha, esta hay que reemplazarla por esta nueva logica) una nueva sección destinada a la:

# ACTUALIZACIÓN DE DATOS DESDE EXCEL

Los datos provienen de VISMA.

No existe conexión directa entre JUBILA y VISMA.

Actualmente se ejecutan queries en VISMA y se exportan manualmente dos archivos Excel:

1. `DatosPersonales`
2. `CarreraAdministrativa`

El usuario deberá poder ingresar al sistema JUBILA, cargar esos dos archivos y ejecutar una sincronización de datos.

Las únicas tablas que deben actualizarse mediante este proceso son:

- `DATOS_PERSONALES_AGENTE_JUBILA`
- `CARRERA_ADMINISTRATIVA`

El resto de las tablas son tablas satélite y NO deben alterarse mediante esta importación.

---

# 3. TABLA DATOS PERSONALES

Tabla:

`DATOS_PERSONALES_AGENTE_JUBILA`

Estructura actual:

```sql
[ID_DATOS_PERSONALES_AGENTE_JUBILA],
[ID_REGIMEN_JUBILATORIO],
[DNI_AGENTE],
[NOMBRE_AGENTE],
[APELLIDO_AGENTE],
[FECHA_NACIMIENTO],
[SECRETARIA],
[PROGRAMA],
[CARGO],
[SEXO],
[ANTIGUEDAD_RECIBO],
[ANTIGUEDAD_LICENCIAS],
[FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA],
[EDAD_ESTIMACION_JUBILACION],
[ESTADO_ACTIVO],
[CUIL],
[NUMERO_TELEFONO],
[CORREO_ELECTRONICO]
```

La clave funcional para identificar un agente será:

`DNI_AGENTE`

Por lo tanto:

- Si el DNI no existe en la tabla, insertar un nuevo agente.
- Si el DNI existe, comparar los datos.
- Si uno o más datos cambiaron, actualizar el agente.
- Si ningún dato cambió, no ejecutar un UPDATE innecesario.
- Nunca insertar dos agentes con el mismo DNI por diferencias de formato.

---

# 4. ARCHIVO EXCEL DATOS PERSONALES

El archivo tendrá como nombre lógico:

`DatosPersonales`

Columnas esperadas:

```text
NOMBRE_REGIMEN
DNI_AGENTE
NOMBRE_AGENTE
APELLIDO_AGENTE
FECHA_NACIMIENTO
SECRETARIA
PROGRAMA
CARGO
SEXO
ESTADO_ACTIVO
CUIL
NUMERO_TELEFONO
CORREO_ELECTRONICO
```

Antes de comenzar cualquier actualización se debe validar que el archivo tenga la estructura correcta.

Debe detectarse:

- columnas faltantes;
- columnas obligatorias;
- archivo inválido;
- Excel corrupto;
- formato no permitido.

Se pueden tolerar:

- espacios accidentales al comienzo/final del nombre de columna;
- diferencias razonables de formato que no cambien el significado.

Pero NO aceptar un archivo que no corresponda al reporte esperado.

---

# 5. CAMPOS DE LA BASE QUE NO VIENEN EN EL EXCEL

La tabla contiene campos que NO vienen desde VISMA:

```text
ID_DATOS_PERSONALES_AGENTE_JUBILA
ANTIGUEDAD_RECIBO
ANTIGUEDAD_LICENCIAS
FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA
EDAD_ESTIMACION_JUBILACION
```

Estos campos NO deben ser modificados durante una actualización desde Excel.

Especialmente:

```text
ANTIGUEDAD_RECIBO
ANTIGUEDAD_LICENCIAS
FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA
EDAD_ESTIMACION_JUBILACION
```

pueden ser campos calculados o mantenidos por otras partes del sistema.

Nunca sobrescribirlos con `NULL`.

Al actualizar un agente existente, actualizar exclusivamente los campos provenientes del reporte.

---

# 6. RÉGIMEN JUBILATORIO

Este es uno de los puntos MÁS IMPORTANTES de toda la implementación.

El Excel NO trae:

`ID_REGIMEN_JUBILATORIO`

El Excel trae:

`NOMBRE_REGIMEN`

El sistema deberá tomar `NOMBRE_REGIMEN`, NORMALIZARLO y obtener el `ID_REGIMEN_JUBILATORIO` correspondiente.

Además, el ID depende también del SEXO.

La tabla diccionario actual de regímenes es:

| ID_REGIMEN_JUBILATORIO | NOMBRE_REGIMEN | SEXO | EDAD_REQUERIDA | ANOS_APORTES_REQUERIDOS |
|---|---|---|---|---|
| 1 | DOCENTES | Masculino | 60 | 25 |
| 2 | DOCENTES | Femenino | 57 | 25 |
| 3 | REGIMEN GENERAL | Masculino | 65 | 30 |
| 4 | REGIMEN GENERAL | Femenino | 60 | 30 |
| 5 | REGIMEN DIFERENCIAL DE SALUD | Masculino | 62 | 25 |
| 6 | REGIMEN DIFERENCIAL DE SALUD | Femenino | 57 | 25 |
| 7 | UNICO REGIMEN | Masculino | 70 | 10 |
| 8 | UNICO REGIMEN | Femenino | 70 | 10 |

Por lo tanto:

```text
DOCENTES + Masculino = ID 1
DOCENTES + Femenino = ID 2

REGIMEN GENERAL + Masculino = ID 3
REGIMEN GENERAL + Femenino = ID 4

REGIMEN DIFERENCIAL DE SALUD + Masculino = ID 5
REGIMEN DIFERENCIAL DE SALUD + Femenino = ID 6

UNICO REGIMEN + Masculino = ID 7
UNICO REGIMEN + Femenino = ID 8
```

NUNCA determinar el ID solamente por el nombre del régimen.

Siempre debe resolverse mediante:

`REGIMEN NORMALIZADO + SEXO NORMALIZADO`

---

# 7. NORMALIZACIÓN DE REGÍMENES

VISMA no siempre devuelve exactamente el mismo nombre que existe en la tabla diccionario.

Existen variantes.

Ejemplos reales del reporte:

```text
DOCENTES
PASIVISADOS - DOCENTES

REGIMEN GENERAL
PASIVISADOS - REGIMEN GENERAL

SALUD - SERV.DIF.ART.18 LEY 9504
PASIVISADOS - SALUD - SERV.DIF.ART.18 LEY 9504
```

También pueden aparecer términos como:

```text
PASIVISADOS
PASIVIZADOS
PAV
```

MUY IMPORTANTE:

Un agente PASIVISADO/PASIVIZADO/PAV NO tiene un régimen distinto.

Debe ser clasificado dentro de su régimen base correspondiente.

La palabra PASIVISADO, PASIVIZADO o PAV debe interpretarse únicamente como una condición adicional y no como otro régimen jubilatorio.

---

# 8. NORMALIZACIÓN DE DOCENTES

Los siguientes ejemplos deben considerarse equivalentes:

```text
DOCENTES
PASIVISADOS - DOCENTES
PASIVIZADOS - DOCENTES
PAV - DOCENTES
```

Todos deben convertirse conceptualmente a:

`DOCENTES`

Posteriormente resolver según sexo:

```text
DOCENTES + Masculino = ID 1
DOCENTES + Femenino = ID 2
```

---

# 9. NORMALIZACIÓN DE RÉGIMEN GENERAL

Ejemplos equivalentes:

```text
REGIMEN GENERAL
RÉGIMEN GENERAL
PASIVISADOS - REGIMEN GENERAL
PASIVIZADOS - REGIMEN GENERAL
PAV - REGIMEN GENERAL
```

Todos deben normalizarse a:

`REGIMEN GENERAL`

Posteriormente:

```text
REGIMEN GENERAL + Masculino = ID 3
REGIMEN GENERAL + Femenino = ID 4
```

---

# 10. NORMALIZACIÓN DE SALUD

Ejemplos que corresponden al régimen diferencial de salud:

```text
SALUD - SERV.DIF.ART.18 LEY 9504
SALUD - SERV. DIF. ART.18 LEY 9504
SALUD - SERV.DIF.ART.18 LEY 9504
PASIVISADOS - SALUD - SERV.DIF.ART.18 LEY 9504
PASIVIZADOS - SALUD - SERV.DIF.ART.18 LEY 9504
PAV - SALUD - SERV.DIF.ART.18 LEY 9504
```

Todos deben normalizarse conceptualmente a:

`REGIMEN DIFERENCIAL DE SALUD`

Posteriormente:

```text
REGIMEN DIFERENCIAL DE SALUD + Masculino = ID 5
REGIMEN DIFERENCIAL DE SALUD + Femenino = ID 6
```

---

# 11. NORMALIZACIÓN DE ÚNICO RÉGIMEN

Los siguientes valores deben considerarse equivalentes:

```text
UNICO REGIMEN
ÚNICO RÉGIMEN
```

y cualquier variante que claramente corresponda a este régimen.

Normalizar a:

`UNICO REGIMEN`

Posteriormente:

```text
UNICO REGIMEN + Masculino = ID 7
UNICO REGIMEN + Femenino = ID 8
```

---

# 12. FUNCIÓN DE NORMALIZACIÓN DEL RÉGIMEN

Crear una función centralizada y reutilizable.

Por ejemplo:

```text
normalizeRegimen(nombreRegimen)
```

La función deberá:

1. hacer trim;
2. pasar temporalmente a mayúsculas;
3. eliminar espacios repetidos;
4. normalizar diferencias de acentos;
5. normalizar espacios alrededor de guiones;
6. tolerar pequeñas variaciones de puntuación;
7. reconocer PASIVISADOS;
8. reconocer PASIVIZADOS;
9. reconocer PAV;
10. eliminar conceptualmente esas condiciones;
11. identificar el régimen base.

Ejemplo conceptual:

```text
si contiene DOCENT
    => DOCENTES

si contiene SALUD
    => REGIMEN DIFERENCIAL DE SALUD

si contiene ART.18 y LEY 9504
    => REGIMEN DIFERENCIAL DE SALUD

si contiene REGIMEN GENERAL
    => REGIMEN GENERAL

si contiene UNICO REGIMEN
    => UNICO REGIMEN
```

El orden de evaluación debe evitar clasificaciones incorrectas.

NO utilizar fuzzy matching indiscriminado.

NO asignar automáticamente un régimen desconocido al régimen general.

Si un régimen no puede determinarse con seguridad:

- marcar fila como error;
- no insertar;
- no actualizar;
- informar al usuario.

---

# 13. NORMALIZACIÓN DEL SEXO

Crear también una función centralizada para normalizar el sexo.

Ejemplo:

```text
normalizeSexo(sexo)
```

Debe reconocer, si aparecen:

```text
M
MASCULINO
Masculino
HOMBRE
```

como:

`Masculino`

Y:

```text
F
FEMENINO
Femenino
MUJER
```

como:

`Femenino`

Si el valor está vacío o no puede determinarse:

- NO asumir;
- NO utilizar un sexo por defecto;
- NO determinar ID_REGIMEN_JUBILATORIO;
- marcar la fila como error.

---

# 14. RESOLUCIÓN DEL ID DEL RÉGIMEN

Crear una función o servicio centralizado.

Por ejemplo:

```text
resolveRegimenId(nombreRegimen, sexo)
```

Debe producir:

```text
DOCENTES + Masculino -> 1
DOCENTES + Femenino -> 2

REGIMEN GENERAL + Masculino -> 3
REGIMEN GENERAL + Femenino -> 4

REGIMEN DIFERENCIAL DE SALUD + Masculino -> 5
REGIMEN DIFERENCIAL DE SALUD + Femenino -> 6

UNICO REGIMEN + Masculino -> 7
UNICO REGIMEN + Femenino -> 8
```

Preferentemente, si la arquitectura actual lo permite, NO hardcodear innecesariamente estos IDs por todo el sistema.

La mejor estrategia es:

1. normalizar nombre del régimen;
2. normalizar sexo;
3. consultar la tabla diccionario de regímenes;
4. buscar coincidencia por:
   - `NOMBRE_REGIMEN`
   - `SEXO`
5. obtener `ID_REGIMEN_JUBILATORIO`.

La lógica de normalización puede estar en código, pero la fuente final del ID debería continuar siendo la tabla de regímenes si esto es compatible con la arquitectura existente.

---

# 15. NORMALIZACIÓN DEL DNI

El DNI será utilizado para identificar agentes.

Antes de comparar:

- convertir a formato consistente;
- quitar espacios;
- evitar `.0` si Excel lo interpreta como número decimal;
- evitar diferencias entre número/string;
- validar que sea un DNI razonable;
- mantener ceros iniciales solamente si realmente forman parte del esquema existente.

Crear una función reutilizable.

Ejemplo:

```text
normalizeDni(dni)
```

Si un DNI está vacío o no puede interpretarse:

- marcar error;
- no insertar;
- no actualizar.

Si el archivo DatosPersonales contiene dos filas con el mismo DNI:

- detectar duplicado;
- informar;
- no realizar una importación ambigua.

---

# 16. SINCRONIZACIÓN DE DATOS PERSONALES

Para cada fila válida del archivo:

## Caso A: DNI no existe

Realizar INSERT en:

`DATOS_PERSONALES_AGENTE_JUBILA`

Campos provenientes de la importación:

```text
ID_REGIMEN_JUBILATORIO
DNI_AGENTE
NOMBRE_AGENTE
APELLIDO_AGENTE
FECHA_NACIMIENTO
SECRETARIA
PROGRAMA
CARGO
SEXO
ESTADO_ACTIVO
CUIL
NUMERO_TELEFONO
CORREO_ELECTRONICO
```

Respetar valores DEFAULT de la base para los demás campos.

---

## Caso B: DNI ya existe

Comparar:

```text
ID_REGIMEN_JUBILATORIO
NOMBRE_AGENTE
APELLIDO_AGENTE
FECHA_NACIMIENTO
SECRETARIA
PROGRAMA
CARGO
SEXO
ESTADO_ACTIVO
CUIL
NUMERO_TELEFONO
CORREO_ELECTRONICO
```

Si un campo cambió:

actualizarlo.

Si ningún campo cambió:

no ejecutar UPDATE.

---

# 17. CAMBIO DE RÉGIMEN

El régimen también debe sincronizarse.

Ejemplo:

Base actual:

```text
DNI: 12345678
REGIMEN GENERAL
Masculino
ID_REGIMEN_JUBILATORIO = 3
```

Nuevo Excel:

```text
DNI: 12345678
DOCENTES
Masculino
```

Resultado esperado:

```text
ID_REGIMEN_JUBILATORIO = 1
```

El sistema debe detectar este cambio y actualizarlo.

---

# 18. CASO PASIVISADO

Ejemplo:

Excel:

```text
NOMBRE_REGIMEN = PASIVISADOS - REGIMEN GENERAL
SEXO = Femenino
```

El sistema debe hacer:

```text
PASIVISADOS - REGIMEN GENERAL
↓
REGIMEN GENERAL
↓
Femenino
↓
ID_REGIMEN_JUBILATORIO = 4
```

Ejemplo:

```text
PASIVISADOS - DOCENTES
Masculino
```

Resultado:

```text
ID_REGIMEN_JUBILATORIO = 1
```

Ejemplo:

```text
PASIVISADOS - SALUD - SERV.DIF.ART.18 LEY 9504
Femenino
```

Resultado:

```text
ID_REGIMEN_JUBILATORIO = 6
```

---

# 19. MANEJO DE NULL Y CAMPOS VACÍOS

Normalizar adecuadamente:

```text
NULL
undefined
""
" "
```

Evitar considerar como cambios falsos diferencias únicamente técnicas.

Por ejemplo:

```text
DB = NULL
Excel = ""
```

pueden considerarse conceptualmente equivalentes dependiendo del campo.

Sin embargo, NO sobrescribir automáticamente un dato existente con NULL si el valor vacío pudiera deberse a un error del reporte.

Analizar cada campo.

La política elegida debe ser consistente.

---

# 20. FECHAS

Las fechas provenientes de Excel deben manejarse de forma robusta.

Excel puede entregar fechas como:

- objetos Date;
- números seriales de Excel;
- strings;
- formatos `dd/mm/yyyy`;
- otros formatos compatibles.

Crear una función centralizada.

Ejemplo:

```text
normalizeDate(...)
```

Evitar problemas de timezone.

Estas fechas son fechas administrativas.

Ejemplo:

```text
01/08/2026
```

debe mantenerse como ese día.

NO debe transformarse accidentalmente en:

```text
31/07/2026
```

por conversión UTC.

---

# 21. TABLA CARRERA ADMINISTRATIVA

Tabla:

`CARRERA_ADMINISTRATIVA`

Estructura:

```sql
[ID_CARRERA],
[DOCUMENTO_EMPLEADO],
[FECHA_ALTA],
[FECHA_BAJA],
[CAUSA_BAJA],
[FECHA_CREACION]
```

MUY IMPORTANTE:

Una misma persona puede tener VARIOS registros de carrera administrativa.

Cada registro representa una fase, período o etapa.

Por lo tanto:

`DOCUMENTO_EMPLEADO`

NO puede utilizarse por sí solo como clave única.

---

# 22. ARCHIVO CARRERA ADMINISTRATIVA

Nombre lógico:

`CarreraAdministrativa`

Columnas provenientes del reporte:

```text
ternro
EMPLEADO
APELLIDO
NOMBRE
ESTADO
CAUSA BAJA
FECHA ALTA
FECHA BAJA
CAUSA
```

Antes de implementar definitivamente el parser, analizar un archivo real o la lógica existente para determinar exactamente:

- cuál columna contiene el DNI/documento;
- cuál columna corresponde realmente a `CAUSA_BAJA`;
- qué representa `ternro`;
- qué representa `EMPLEADO`;
- si `EMPLEADO` es DNI, legajo u otro identificador.

NO asumir sin verificar si no puede inferirse de manera segura.

La tabla destino únicamente necesita:

```text
DOCUMENTO_EMPLEADO
FECHA_ALTA
FECHA_BAJA
CAUSA_BAJA
FECHA_CREACION
```

Columnas del Excel como:

```text
APELLIDO
NOMBRE
ESTADO
```

NO deben agregarse a la tabla simplemente porque existen en el reporte.

No modificar el esquema innecesariamente.

---

# 23. CONCEPTO DE CARRERA ADMINISTRATIVA

Una persona puede tener muchas fases.

Ejemplo:

```text
DNI 12345678

01/01/2010 -> 30/06/2014
01/07/2014 -> 31/12/2020
01/01/2021 -> NULL
```

Estos son TRES registros.

NO debe quedar solamente el último.

El sistema debe mantener todo el historial.

---

# 24. CLAVE FUNCIONAL DE UNA FASE

Como primera hipótesis de diseño utilizar:

```text
DOCUMENTO_EMPLEADO + FECHA_ALTA
```

para identificar una fase.

Antes de implementarlo definitivamente, verificar en los datos existentes que esa combinación sea efectivamente única.

Si los datos confirman esta regla, utilizarla.

Si existen casos donde una persona puede tener dos fases con la misma FECHA_ALTA, analizar la estructura real antes de decidir otra clave.

NO asumir silenciosamente.

---

# 25. LÓGICA DE ACTUALIZACIÓN DE CARRERA

## Caso A: fase inexistente

Si no existe:

```text
DOCUMENTO_EMPLEADO = X
FECHA_ALTA = Y
```

crear una nueva fila.

---

## Caso B: fase existente

Si existe:

```text
DOCUMENTO_EMPLEADO = X
FECHA_ALTA = Y
```

comparar:

```text
FECHA_BAJA
CAUSA_BAJA
```

Si cambiaron, actualizar ESA fase.

---

# 26. EJEMPLO DE FASE ABIERTA

Base actual:

```text
DOCUMENTO_EMPLEADO = 12345678
FECHA_ALTA = 01/01/2025
FECHA_BAJA = NULL
CAUSA_BAJA = NULL
```

Posteriormente VISMA informa:

```text
DOCUMENTO_EMPLEADO = 12345678
FECHA_ALTA = 01/01/2025
FECHA_BAJA = 30/08/2026
CAUSA_BAJA = RENUNCIA
```

Resultado esperado:

actualizar la fase existente.

NO insertar una fase duplicada.

Resultado:

```text
DOCUMENTO_EMPLEADO = 12345678
FECHA_ALTA = 01/01/2025
FECHA_BAJA = 30/08/2026
CAUSA_BAJA = RENUNCIA
```

---

# 27. NUEVA FASE

Base:

```text
12345678 | 01/01/2020 | 31/12/2022
12345678 | 01/01/2023 | NULL
```

Nuevo Excel contiene:

```text
12345678 | 01/08/2026 | NULL
```

Como la FECHA_ALTA es nueva:

crear otra fila.

Resultado:

```text
12345678 | 01/01/2020 | 31/12/2022
12345678 | 01/01/2023 | ...
12345678 | 01/08/2026 | NULL
```

Nunca borrar las anteriores.

---

# 28. REGLA CRÍTICA DE CARRERA ADMINISTRATIVA

NUNCA hacer algo equivalente a:

```sql
UPDATE CARRERA_ADMINISTRATIVA
SET ...
WHERE DOCUMENTO_EMPLEADO = ?
```

sin identificar además la fase correspondiente.

Eso podría actualizar todo el historial de una persona.

La actualización debe identificar exactamente el registro correcto.

---

# 29. FECHA_CREACION

Para registros nuevos:

respetar la lógica actual de la aplicación/base.

Si la columna tiene DEFAULT:

utilizar ese DEFAULT.

Si actualmente el backend asigna la fecha:

seguir el patrón existente.

Cuando una fase ya existente sea actualizada:

NO modificar `FECHA_CREACION`.

---

# 30. ORDEN DEL PROCESO

La importación deberá ejecutarse en este orden:

```text
Usuario selecciona archivos
↓
Validación de archivos
↓
Validación de columnas
↓
Lectura de Excel
↓
Normalización de datos
↓
Normalización de DNI
↓
Normalización de sexo
↓
Normalización de régimen
↓
Resolución de ID_REGIMEN_JUBILATORIO
↓
Normalización de fechas
↓
Detección de registros inválidos
↓
Detección de duplicados
↓
Preparación de cambios
↓
Actualización Datos Personales
↓
Actualización Carrera Administrativa
↓
COMMIT
↓
Resumen de importación
```

Datos Personales debe procesarse primero.

Luego Carrera Administrativa.

---

# 31. VALIDACIÓN PREVIA

NO comenzar a escribir en la base mientras todavía se están validando filas.

Primero:

```text
leer
↓
normalizar
↓
validar
↓
comparar
↓
preparar operaciones
```

Solamente después:

```text
INSERT / UPDATE
```

---

# 32. ERRORES CRÍTICOS

Considerar errores críticos, entre otros:

- régimen desconocido;
- sexo desconocido;
- DNI vacío;
- DNI inválido;
- DNI duplicado;
- fecha inválida;
- archivo incorrecto;
- columnas faltantes;
- documento de Carrera Administrativa vacío;
- combinación régimen + sexo inexistente;
- Excel corrupto;
- estructura inesperada.

Ante un error:

NO adivinar.

Mostrar:

```text
Archivo
Fila
Campo
Valor recibido
Descripción del error
```

Ejemplo:

```text
Archivo: DatosPersonales.xlsx
Fila: 482
Campo: NOMBRE_REGIMEN
Valor recibido: "REG ESP SALUD XYZ"
Error: no se pudo determinar el régimen jubilatorio.
```

---

# 33. TRANSACCIONES

La actualización debe preservar la integridad.

Una vez validados los archivos, ejecutar la escritura dentro de una transacción.

Conceptualmente:

```text
BEGIN TRANSACTION

actualizar Datos Personales

actualizar Carrera Administrativa

si todo sale correctamente:
    COMMIT

si ocurre un error:
    ROLLBACK
```

Evitar estados parciales.

No debe quedar:

```text
Datos Personales actualizado
Carrera Administrativa a mitad
```

si ambas cargas pertenecen al mismo proceso.

---

# 34. NO BORRAR INFORMACIÓN

Este proceso debe realizar:

```text
INSERT
UPDATE
```

NO realizar:

```text
DELETE
```

Si un agente existe en JUBILA pero no aparece en el Excel:

NO borrarlo automáticamente.

Si una fase de Carrera Administrativa existe en JUBILA pero no aparece en el reporte:

NO borrarla.

---

# 35. RENDIMIENTO

Los archivos pueden contener miles de registros.

Evitar una implementación del tipo:

```text
por cada fila:
    SELECT
    después UPDATE
```

si esto produce miles de consultas individuales.

Aplicar una estrategia eficiente.

Por ejemplo:

1. cargar todos los DNI relevantes;
2. consultar en lote los agentes existentes;
3. construir un Map/diccionario;
4. comparar en memoria;
5. determinar INSERTS;
6. determinar UPDATES;
7. ejecutar operaciones por lotes cuando sea posible.

Lo mismo para Carrera Administrativa.

Evitar problemas N+1.

---

# 36. PREVISUALIZACIÓN DE CAMBIOS

Si resulta razonable dentro de la arquitectura actual, antes de confirmar la importación mostrar un resumen.

Por ejemplo:

```text
Datos Personales

Registros encontrados: 3500
Nuevos: 23
A actualizar: 142
Sin cambios: 3335
Errores: 0
```

Y:

```text
Carrera Administrativa

Registros encontrados: 8000
Nuevas fases: 45
Fases a actualizar: 28
Sin cambios: 7927
Errores: 0
```

Idealmente permitir:

`Confirmar actualización`

antes de modificar definitivamente la base.

Si implementar una previsualización requiere una complejidad desproporcionada respecto de la arquitectura actual, evaluar la mejor solución, pero priorizar seguridad.

---

# 37. DETALLE DE CAMBIOS

Cuando sea posible, determinar qué campos cambiaron.

Ejemplo:

```text
DNI 12345678

CARGO:
ADMINISTRATIVO
→
JEFE DE DEPARTAMENTO

SECRETARIA:
SECRETARIA GENERAL
→
SECRETARIA DE GOBIERNO
```

No es necesario renderizar miles de cambios simultáneamente.

Puede existir:

- resumen;
- contador;
- tabla paginada;
- detalle expandible.

---

# 38. INTERFAZ DE USUARIO

Crear una nueva sección dentro de JUBILA.

Nombre sugerido:

`Actualización de datos`

Debe mantener:

- misma estética;
- mismos colores;
- mismos componentes;
- misma tipografía;
- mismo sistema de navegación;
- mismos patrones UX del proyecto.

No introducir una interfaz visual completamente diferente.

---

# 39. CARGA DE ARCHIVOS

La pantalla debe permitir seleccionar:

## Archivo de Datos Personales

```text
DatosPersonales.xlsx
```

## Archivo de Carrera Administrativa

```text
CarreraAdministrativa.xlsx
```

Mostrar claramente:

```text
Archivo seleccionado
Nombre
Tamaño
Estado
```

Validar extensión y tipo de archivo en frontend y backend.

No confiar únicamente en la extensión enviada por el navegador.

---

# 40. ESTADOS VISUALES

La interfaz debe poder mostrar estados:

```text
Esperando archivos
Archivos seleccionados
Validando
Analizando
Archivo inválido
Preparando cambios
Actualizando datos
Actualización finalizada
Actualización con errores
```

Si la operación tarda varios segundos, mostrar feedback visual.

Puede utilizarse:

- spinner;
- barra de progreso;
- etapas;
- porcentaje si técnicamente puede calcularse correctamente.

No inventar un porcentaje falso si no existe forma de conocer el progreso.

---

# 41. RESULTADO FINAL

Luego de terminar mostrar un resumen.

Ejemplo:

## Datos Personales

```text
Registros leídos: 3.450
Agentes nuevos: 32
Agentes actualizados: 184
Sin cambios: 3.234
Errores: 0
```

## Carrera Administrativa

```text
Registros leídos: 8.921
Fases nuevas: 61
Fases actualizadas: 47
Sin cambios: 8.813
Errores: 0
```

---

# 42. AUDITORÍA

Analizar si el proyecto actualmente posee auditoría.

Si existe, reutilizarla.

Idealmente registrar:

```text
Usuario que ejecutó la importación
Fecha
Hora
Archivo Datos Personales
Archivo Carrera Administrativa
Cantidad de filas
Agentes insertados
Agentes actualizados
Fases insertadas
Fases actualizadas
Errores
Duración
Estado final
```

NO crear una tabla nueva de auditoría automáticamente si ya existe un mecanismo equivalente.

Si no existe auditoría, indicar una propuesta antes de agregar nueva infraestructura innecesaria.

---

# 43. SEGURIDAD

La importación modifica información crítica.

Aplicar:

- autenticación existente;
- permisos existentes;
- validación backend;
- tamaño máximo de archivo;
- validación del tipo de archivo;
- queries parametrizadas;
- protección contra SQL Injection;
- manejo seguro de excepciones;
- no mostrar stack traces al usuario;
- no exponer credenciales;
- no registrar información sensible innecesariamente.

---

# 44. SEPARACIÓN DE RESPONSABILIDADES

No implementar todo en un único archivo gigante.

Separar conceptualmente:

```text
Excel parser
Validación de archivos
Validación de columnas
Normalización de DNI
Normalización de fechas
Normalización de sexo
Normalización de régimen
Resolución de ID_REGIMEN_JUBILATORIO
Comparación de Datos Personales
Comparación de Carrera Administrativa
Persistencia
Transacciones
Auditoría
API/backend
UI
```

Adaptar esta separación a la arquitectura real existente.

---

# 45. FUNCIONES IMPORTANTES TESTEABLES

La lógica crítica debe poder probarse independientemente.

Funciones conceptuales:

```text
normalizeRegimen()
normalizeSexo()
resolveRegimenId()
normalizeDni()
normalizeDate()
compareDatosPersonales()
compareCarreraAdministrativa()
```

Los nombres pueden cambiar para respetar las convenciones del proyecto.

---

# 46. TESTS OBLIGATORIOS DE RÉGIMEN

Verificar al menos:

```text
DOCENTES + Masculino
=> 1

DOCENTES + Femenino
=> 2

PASIVISADOS - DOCENTES + Masculino
=> 1

PASIVISADOS - DOCENTES + Femenino
=> 2

PASIVIZADOS - DOCENTES + Masculino
=> 1

PAV - DOCENTES + Femenino
=> 2

REGIMEN GENERAL + Masculino
=> 3

REGIMEN GENERAL + Femenino
=> 4

PASIVISADOS - REGIMEN GENERAL + Masculino
=> 3

PASIVISADOS - REGIMEN GENERAL + Femenino
=> 4

SALUD - SERV.DIF.ART.18 LEY 9504 + Masculino
=> 5

SALUD - SERV.DIF.ART.18 LEY 9504 + Femenino
=> 6

PASIVISADOS - SALUD - SERV.DIF.ART.18 LEY 9504 + Masculino
=> 5

PASIVISADOS - SALUD - SERV.DIF.ART.18 LEY 9504 + Femenino
=> 6

UNICO REGIMEN + Masculino
=> 7

UNICO REGIMEN + Femenino
=> 8
```

Además:

```text
REGIMEN DESCONOCIDO
```

debe producir ERROR.

Nunca asignarlo automáticamente.

---

# 47. TESTS DE DATOS PERSONALES

## Persona nueva

```text
DNI no existe
=> INSERT
```

## Persona existente sin cambios

```text
DNI existe
datos iguales
=> NO UPDATE
```

## Cambio de teléfono

```text
DNI existe
NUMERO_TELEFONO diferente
=> UPDATE
```

## Cambio de correo

```text
DNI existe
CORREO_ELECTRONICO diferente
=> UPDATE
```

## Cambio de cargo

```text
DNI existe
CARGO diferente
=> UPDATE
```

## Cambio de Secretaría

```text
DNI existe
SECRETARIA diferente
=> UPDATE
```

## Cambio de régimen

```text
antes:
REGIMEN GENERAL
Masculino
ID 3

ahora:
DOCENTES
Masculino

resultado:
ID 1
```

## Pasivizado

```text
PASIVISADOS - REGIMEN GENERAL
Femenino

=> REGIMEN GENERAL
=> ID 4
```

---

# 48. TESTS CARRERA ADMINISTRATIVA

## Fase nueva

```text
DOCUMENTO = 12345678
FECHA_ALTA = 01/01/2026

No existe

=> INSERT
```

## Fase existente sin cambios

```text
DOCUMENTO = 12345678
FECHA_ALTA = 01/01/2026

Existe y resto de campos iguales

=> NO UPDATE
```

## Fase abierta que luego tiene baja

Antes:

```text
DOCUMENTO = 12345678
FECHA_ALTA = 01/01/2025
FECHA_BAJA = NULL
CAUSA_BAJA = NULL
```

Después:

```text
DOCUMENTO = 12345678
FECHA_ALTA = 01/01/2025
FECHA_BAJA = 30/06/2026
CAUSA_BAJA = RENUNCIA
```

Resultado:

```text
UPDATE del registro existente
```

NO INSERT duplicado.

---

# 49. CAMPOS NO PROVENIENTES DEL EXCEL

Comprobar específicamente que una importación NO modifique accidentalmente:

```text
ANTIGUEDAD_RECIBO
ANTIGUEDAD_LICENCIAS
FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA
EDAD_ESTIMACION_JUBILACION
```

Estos campos deben conservar su valor.

---

# 50. CASOS DE ERROR

Testear:

```text
DNI vacío
DNI duplicado
Sexo vacío
Sexo desconocido
Régimen vacío
Régimen desconocido
Fecha inválida
Archivo incorrecto
Excel vacío
Columna faltante
Fila completamente vacía
CUIL extraño
Carrera sin documento
Carrera con fecha inválida
```

Las filas completamente vacías al final del Excel pueden ignorarse.

Las filas parcialmente cargadas deben validarse.

---

# 51. NO CONFIAR EN EL FRONTEND

Toda validación crítica debe repetirse o realizarse en backend.

El frontend solamente mejora UX.

La seguridad e integridad debe estar en servidor.

---

# 52. NO PERMITIR DOBLE EJECUCIÓN ACCIDENTAL

Mientras una importación está ejecutándose:

- deshabilitar el botón de importación;
- evitar doble click;
- evitar dos requests idénticos enviados accidentalmente;
- manejar correctamente estado loading.

Si la arquitectura permite implementar idempotencia de forma sencilla y adecuada, hacerlo.

---

# 53. OBJETIVO DE EXPERIENCIA DE USUARIO

El flujo final debería sentirse así:

```text
Usuario entra a "Actualización de datos"

↓

Selecciona DatosPersonales.xlsx

↓

Selecciona CarreraAdministrativa.xlsx

↓

Sistema valida

↓

Sistema analiza

↓

Sistema informa qué va a cambiar

↓

Usuario confirma

↓

Sistema actualiza

↓

Sistema muestra resultado
```

Debe ser sencillo para un usuario administrativo no técnico.

---

# 54. FLUJO GENERAL DEL SISTEMA

```text
VISMA
│
├── Query Datos Personales
│       │
│       └── DatosPersonales.xlsx
│
└── Query Carrera Administrativa
        │
        └── CarreraAdministrativa.xlsx

                ↓

        SISTEMA JUBILA

                ↓

        Validación de archivos

                ↓

        Normalización

        ├── DNI
        ├── fechas
        ├── sexo
        └── régimen

                ↓

        Comparación con DB

                ↓

        DATOS PERSONALES

        ├── INSERT nuevos
        ├── UPDATE modificados
        └── IGNORAR sin cambios

                ↓

        CARRERA ADMINISTRATIVA

        ├── INSERT nuevas fases
        ├── UPDATE fases existentes
        └── PRESERVAR historial

                ↓

        TRANSACCIÓN

                ↓

        RESULTADO
```

---

# 55. FORMA DE TRABAJO SOLICITADA

NO comenzar escribiendo código sin antes analizar el proyecto.

Trabajar en las siguientes etapas.

---

## ETAPA 1 — ANÁLISIS

Primero inspeccionar el proyecto y explicar:

```text
Stack encontrado
Arquitectura
Framework
Forma de acceso a DB
ORM o librería SQL
Sistema de autenticación
Sistema de permisos
Estructura frontend
Estructura backend
Componentes reutilizables
Servicios existentes
Endpoints relacionados
Modelos existentes
```

También identificar qué archivos probablemente deberán modificarse.

---

## ETAPA 2 — ANÁLISIS DE BASE DE DATOS

Analizar:

```text
DATOS_PERSONALES_AGENTE_JUBILA
CARRERA_ADMINISTRATIVA
tabla de REGIMEN_JUBILATORIO
```

Confirmar:

- tipos reales de columnas;
- claves primarias;
- foreign keys;
- índices;
- defaults;
- nullability;
- constraints;
- relaciones.

Especialmente verificar si:

`DNI_AGENTE`

tiene índice o restricción de unicidad.

Y analizar si sería conveniente tener alguna protección contra duplicados sin modificar innecesariamente el esquema actual.

---

## ETAPA 3 — PLAN DE IMPLEMENTACIÓN

Antes de escribir código, presentar un plan detallado indicando:

```text
Archivos nuevos
Archivos a modificar
Componentes frontend
Servicios backend
Parser Excel
Validadores
Normalizadores
Queries
Transacciones
Auditoría
```

Explicar brevemente para qué servirá cada archivo.

---

## ETAPA 4 — RESOLVER DUDAS DE CARRERA ADMINISTRATIVA

Antes de implementar esa parte definitivamente, confirmar:

1. qué columna del Excel corresponde a `DOCUMENTO_EMPLEADO`;
2. qué representa `ternro`;
3. qué representa `EMPLEADO`;
4. si `CAUSA BAJA` o `CAUSA` corresponde a `CAUSA_BAJA`;
5. si `DOCUMENTO_EMPLEADO + FECHA_ALTA` identifica una fase de manera única.

Si puede determinarse inspeccionando el proyecto o los datos, hacerlo.

Si no puede determinarse con seguridad:

DETENER ESA PARTE Y PREGUNTAR.

NO ADIVINAR.

---

## ETAPA 5 — IMPLEMENTACIÓN

Una vez entendido todo lo anterior, implementar el módulo completo.

Mantener:

- código limpio;
- separación de responsabilidades;
- tipado;
- manejo de errores;
- seguridad;
- rendimiento;
- diseño existente.

---

## ETAPA 6 — VERIFICACIÓN

Luego de implementar:

Ejecutar las verificaciones disponibles:

```text
npm run build
npm run lint
TypeScript
tests
```

o los comandos equivalentes existentes en el proyecto.

No inventar scripts que no existan.

Corregir errores generados por la implementación.

---

# 56. VERIFICACIONES FINALES OBLIGATORIAS

Antes de considerar terminada la tarea verificar:

- que el proyecto compile;
- que no haya errores TypeScript;
- que el módulo pueda leer Excel;
- que detecte archivo incorrecto;
- que detecte columnas incorrectas;
- que normalice PASIVISADOS;
- que normalice PAV;
- que distinga masculino/femenino;
- que determine correctamente IDs 1 a 8;
- que inserte agentes nuevos;
- que actualice agentes existentes;
- que no haga UPDATE si nada cambió;
- que no duplique DNI;
- que no pise campos calculados;
- que inserte nuevas fases administrativas;
- que actualice fases existentes;
- que no elimine fases históricas;
- que no actualice todas las fases de un DNI;
- que una falla genere rollback;
- que otras tablas no sean modificadas.

---

# 57. DOCUMENTACIÓN FINAL

Después de implementar, entregar un resumen claro indicando:

```text
Qué archivos fueron creados
Qué archivos fueron modificados
Cómo funciona la importación
Cómo funciona la normalización
Cómo se identifica un agente
Cómo se identifica una fase administrativa
Cómo funciona la transacción
Cómo se manejan los errores
Cómo probar el módulo
```

Además indicar cualquier supuesto que haya tenido que realizarse.

---

# 58. REGLAS ABSOLUTAS

Estas reglas son prioritarias:

1. NO borrar agentes porque no aparezcan en el Excel.
2. NO borrar fases administrativas.
3. NO sobrescribir todo el historial de Carrera Administrativa.
4. NO actualizar Carrera Administrativa solamente por DNI.
5. NO asignar régimen por defecto.
6. NO asignar sexo por defecto.
7. NO continuar silenciosamente ante un régimen desconocido.
8. NO pisar campos que no vienen desde Excel.
9. NO modificar tablas satélite.
10. NO insertar datos ambiguos.
11. NO realizar cambios estructurales innecesarios.
12. NO asumir datos que puedan verificarse inspeccionando el proyecto.
13. NO hardcodear lógica innecesariamente si ya existe una tabla diccionario.
14. NO utilizar fuzzy matching peligroso para regímenes.
15. NO realizar DELETE durante esta sincronización.

---

# 59. PRIORIDAD MÁXIMA: INTEGRIDAD DE DATOS

Este sistema administra información de empleados y procesos jubilatorios.

La prioridad absoluta de toda la implementación debe ser:

**INTEGRIDAD DE LOS DATOS.**

Si existe una situación donde el sistema no puede determinar con seguridad:

```text
DNI
Sexo
Régimen
ID_REGIMEN_JUBILATORIO
Fecha
Fase administrativa
Documento
```

el comportamiento correcto es:

```text
DETENER / MARCAR ERROR
```

y NO:

```text
ADIVINAR / ASIGNAR POR DEFECTO
```

---

# 60. RESULTADO FINAL ESPERADO

Una vez implementado correctamente, el usuario deberá poder actualizar JUBILA periódicamente simplemente haciendo:

```text
1. Exportar DatosPersonales desde VISMA
2. Exportar CarreraAdministrativa desde VISMA
3. Entrar a JUBILA
4. Ir a "Actualización de datos"
5. Cargar ambos Excel
6. Validarlos
7. Confirmar actualización
8. Recibir resumen
```

Y el sistema deberá encargarse automáticamente de:

```text
Normalizar datos
Normalizar regímenes
Reconocer PASIVISADOS/PAV
Resolver ID de régimen según sexo
Detectar personas nuevas
Insertar personas nuevas
Detectar cambios
Actualizar personas existentes
Preservar datos calculados
Detectar nuevas fases administrativas
Insertar nuevas fases
Actualizar fases existentes
Preservar historial
Evitar duplicados
Registrar errores
Realizar rollback si corresponde
Mostrar resultado final
```

Sin necesidad de realizar manualmente modificaciones directas sobre la base de datos.

---

# INSTRUCCIÓN FINAL PARA ANTIGRAVITY

Primero inspeccioná el proyecto completo y comprendé cómo está construido.

NO empieces modificando código inmediatamente.

Primero presentame:

1. análisis de la arquitectura actual;
2. archivos relevantes encontrados;
3. forma actual de acceso a la base de datos;
4. propuesta de implementación;
5. archivos que crearías;
6. archivos que modificarías;
7. dudas o inconsistencias reales que deban resolverse.

Una vez comprendido el contexto, avanzá con la implementación completa.

Siempre respetando como prioridad:

**NO PERDER DATOS, NO DUPLICAR DATOS, NO SOBREESCRIBIR HISTORIAL Y NO ASIGNAR DATOS JUBILATORIOS INCORRECTOS.**