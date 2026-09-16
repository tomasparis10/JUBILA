## NIVEL 1 — BLOQUEADORES (hacer antes de subir a la nube)

### 1. Hashear las contraseñas de los usuarios
* **Dónde:** `app/actions/auth.ts:45` (comparación `contrasena === usuario.CONTRASENA_USUARIO`) y esquema `prisma/schema.prisma` (`CONTRASENA_USUARIO` es `VarChar(255)`).
* **Qué cambiar:**
  * Agregar dependencia `bcryptjs` (evita `bcrypt` nativo que requiere compilación, más simple en serverless).
  * Crear un script de migración (`scripts/hashPasswords.ts`) que recorra `USUARIO`, detecte contraseñas sin hashear (ej: no empiezan con `$2a$/$2b$`), y las reescriba con `bcrypt.hash()`. Ejecutar UNA vez contra la DB.
  * En `loginUsuario`, reemplazar la comparación directa por `bcrypt.compare(contrasena, usuario.CONTRASENA_USUARIO)`.
* **Por qué:** hoy cualquier persona con acceso de lectura a la DB ve todas las contraseñas en claro.
* **Nota:** hay que ejecutarlo con una sesión de usuario que sepa la contraseña original, o pedirle a cada usuario que la cambie al primer ingreso.

### 2. Eliminar la credencial de la base de datos del repositorio
* **Dónde:** `CargarTablas.py:12` contenía una URL de conexión con usuario y contraseña, además de rutas locales.
* **Qué cambiar:**
  * `git rm CargarTablas.py` (o moverlo fuera del repo) y agregarlo a `.gitignore`.
  * Rotar la contraseña SQL expuesta (aunque el archivo se edite, quedó en el historial de git).
  * Si el historial importa, reescribirlo (`git filter-repo/filter-branch`), o directamente empezar el repo limpio para el deploy.
  * Dejar solo una forma de conectarse: variables de entorno.
* **Por qué:** el password está permanentemente expuesto en git aunque `.env` esté ignorado.

### 3. Conexión SQL con TLS obligatorio
* **Dónde:** `.env` — `trustServerCertificate=true`.
* **Qué cambiar:** en producción usar `Encrypt=Yes;TrustServerCertificate=No` y con certificado válido (Azure SQL ya lo tiene). En dev con VPN se puede dejar el actual, pero idealmente también TLS.
* **Por qué:** `trustServerCertificate=true` permite intercepción (MITM) de la conexión a la DB — todo pasa en claro entre la app y SQL Server.

### 4. Prepare `.env.example`
* **Qué crear:** archivo `.env.example` con las variables que la plataforma necesita, sin valores reales:
  ```env
  DATABASE_URL="sqlserver://HOST;database=jubila;user=USUARIO;password=CLAVE;encrypt=true;trustServerCertificate=false"
  SESSION_SECRET="<generar con openssl rand -base64 32>"
  ```
* **Por qué:** documenta qué variables cargar en el proveedor de nube.

## NIVEL 2 — ALTO (seguridad e integridad de datos)

### 5. No confiar en el análisis que manda el cliente en el commit masivo
* **Dónde:** `app/api/bulk-sync/commit/route.ts:92-101` (recibe el `AnalysisResult` completo del cliente y lo aplica directo).
* **Qué cambiar (elegir una):**
  * **Opción A (simple):** que `/analyze` devuelva además de los datos un token/hash firmado; `/commit` valide ese token y vuelva a leer los archivos subidos del servidor para re-analizar antes de escribir.
  * **Opción B (recomendada):** que `/commit` no acepte el análisis del cliente; que guarde los archivos en memoria/DB al hacer `/analyze` y `/commit` re-ejecute el análisis server-side desde esos archivos. El cliente solo manda "confirmar".
* **Por qué:** un usuario autenticado puede fabricar el JSON y modificar filas arbitrarias de `CARRERA_ADMINISTRATIVA` por `ID_CARRERA`, insertar agentes falsos o setear regímenes que no existen.

### 6. Rate-limit del login (anti fuerza bruta)
* **Dónde:** `app/actions/auth.ts` (`loginUsuario`).
* **Qué cambiar:** registrar intentos fallidos en una tabla (`INTENTOS_LOGIN`: usuario, IP, timestamp) o en memoria (si es un solo server). Bloquear después de ~5 intentos en 15 minutos, con espera de 30s entre fallos (backoff). Registrar cada fallo con `console.error`/tabla.
* **Por qué:** hoy se puede probar contraseñas infinitas veces sin límite.

### 7. Actualizar la librería xlsx
* **Dónde:** `package.json:25` → `xlsx@^0.18.5`.
* **Qué cambiar:** a `^0.19.3` o la versión `0.20.x` del CDN oficial de SheetJS (la de npm dejó de actualizarse). Alternativa sólida: reemplazar `xlsx` por `exceljs`.
* **Por qué:** CVE-2023-30533 (prototype pollution/ReDoS); la versión se retiró del registro npm y parsea archivos subidos por usuarios.

### 8. Activar TypeScript en el build
* **Dónde:** `next.config.mjs:3-5` → `typescript.ignoreBuildErrors: true`.
* **Qué cambiar:** borrar esa opción (y corregir los errores de tipo que aparezcan).
* **Por qué:** con `strict: true` en tsconfig, un error de tipo silenciado puede explotar en runtime (ej: `undefined` manejado mal).

## NIVEL 3 — MEDIO (recomendados)

### 9. Middleware central de autenticación
* **Qué crear:** `src/middleware.ts` (o `middleware.ts` a la raíz) que valide `getAuthenticatedSession()` para todas las rutas `app/api/*` y páginas protegidas, con excepción para `/api/auth/login` y el login.
* **Por qué:** hoy cada action/route debe acordarse de llamar `requireAuthenticatedSession()`. Una nueva ruta sin ese check queda abierta por defecto.

### 10. No exponer errores internos al cliente
* **Dónde:** `app/actions/auth.ts:68` (devuelve 120 chars del error de driver) y `app/api/bulk-sync/commit/route.ts:350-362` (detalle crudo del error de Prisma).
* **Qué cambiar:** devolver un mensaje genérico ("Error interno, intente de nuevo") y loguear el detalle completo solo server-side.
* **Por qué:** los errores de mssql/Prisma pueden filtrar nombres de tablas, del servidor y detalles de conexión.

### 11. Autorización por recurso en archivos (IDOR)
* **Dónde:** `app/api/archivos/route.ts:23-38` (leer cualquier archivo por ID) y `app/actions/archivos.ts:117-130` (`eliminarArchivo` sin verificación).
* **Qué cambiar:** verificar que el `ID_ARCHIVO` pertenece a un `ID_JUBILA` que el usuario tiene permitido ver/editar (regla también válida sin roles: al menos restringir a que el archivo exista y no esté borrado, con auditoría de accesos).
* **Por qué:** cualquier usuario autenticado puede leer/borrar archivos ajenos (DNIs, renuncias, info médica).

### 12. Sanitizar nombres de archivo al subir
* **Dónde:** `app/actions/archivos.ts:96` (guarda `file.name`) y `app/api/archivos/route.ts:43` (arma `Content-Disposition`).
* **Qué cambiar:** limpiar el nombre (quitar `", CR/LF, \,` caracteres de control) y agregar header `X-Content-Type-Options: nosniff` en la respuesta.
* **Por qué:** un nombre malicioso puede inyectar headers HTTP.

### 13. Verificar tipo real del archivo subido (magic bytes)
* **Dónde:** `app/actions/archivos.ts:77-81` (valida solo por extensión/MIME declarado).
* **Qué cambiar:** comprobar los primeros bytes (PDF empieza con `%PDF`, JPG con `FF D8 FF`, PNG con `89 50 4E 47`).
* **Por qué:** se puede subir un `.exe` renombrado a `.pdf`.

### 14. Capar el límite de `getJubilaList`
* **Dónde:** `app/actions/agentes.ts` (`getJubilaList(take = 50)`).
* **Qué cambiar:** `Math.min(take, 100)`.
* **Por qué:** un cliente puede pedir filas ilimitadas y saturar la DB.

### 15. Agregar headers de seguridad globales
* **Dónde:** `next.config.mjs` (función `headers()`).
* **Qué cambiar:** añadir `Content-Security-Policy`, `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
* **Por qué:** la app sirve PDFs/imágenes subidas e información personal; hoy no hay ninguna protección CSP.

### 16. Errores sensibles fuera de los logs centralizados
* **Dónde:** `app/actions/auth.ts:66`, `app/api/bulk-sync/commit/route.ts:345-348`, `app/api/bulk-sync/analyze/route.ts:203`.
* **Qué cambiar:** normalizador que redacte la `DATABASE_URL` y cualquier secret antes de loguear `err.message`.
* **Por qué:** los logs de la nube quedan visibles a admins; el error de conexión puede incluir la cadena con el password.

## NIVEL 4 — BAJO / PARA LA NUBE (operativos)

### 17. Blobs en vez de varbinary para archivos
* **Dónde:** `prisma/schema.prisma:15` (`DATOS_ARCHIVO Bytes`) y `app/actions/archivos.ts`.
* **Qué cambiar:** migrar a Azure Blob / S3 (guardar la URL o key en la DB).
* **Por qué:** archivos de 10MB+ inflan el tamaño de la DB y encarecen el hosting en la nube; además `next start` en serverless tiene límite de respuesta.

### 18. Sacar el commit masivo del request (colas)
* **Dónde:** `app/api/bulk-sync/commit/route.ts:38` (`maxDuration = 300`) y el loop de recálculo de todos los agentes (`:373-444`).
* **Qué cambiar:** moverlo a un job/worker (Vercel Background Functions, cron, o un worker aparte) para no bloquear el pedido HTTP ni exceder el límite del plan (Hobby = 60s).
* **Por qué:** el recálculo recorre todos los agentes con hasta 50 updates concurrentes; puede superar el límite de duración.

### 19. Límite de subida y maxDuration del análisis
* **Dónde:** `app/api/bulk-sync/analyze/route.ts` y `lib/bulk-sync/validators.ts` (50MB por archivo).
* **Qué cambiar:** bajarlo (ej: 25MB) y confirmar que el maxDuration/memoria del plan alojado alcanzan.
* **Por qué:** en Vercel el body default es ~4.5MB; `XLSX.read` de archivos grandes consume mucha memoria.

### 20. Prisma en producción (cold start)
* **Dónde:** `lib/prisma.ts:3-11` (solo cachea en dev).
* **Qué cambiar:** cachear siempre en `globalThis` (patrón oficial de Next) para reducir reconexiones en cold start.
* **Por qué:** cada cold start en serverless creaba un cliente nuevo.

### 21. Aclarar dependencias para la nube
* **Qué chequear:** `@prisma/client ^5.22.0` (2024) vs Prisma 6/7; `next 16.2.6`, `react ^19`. Correr `npm audit` en CI.
* **Por qué:** actualizaciones traen parches de seguridad y mejor manejo del pool.

### 22. Logs y monitoreo
* **Qué agregar:** logging estructurado (o al menos asegurar que `console.error` llegue al dashboard del proveedor), y alerta si el login falla en cadena.

### 23. Git: revisar que no queden otros secretos
* **Qué hacer:** `git log -p` y revisar `test_prox.js` y cualquier `.ts` utilizado para scripts de carga; asegurar que no repitan el password.

---

## Resumen rápido (si solo querés lo mínimo)

| Prioridad | Cambios |
| :--- | :--- |
| **Mínimo para la nube** | 1, 2, 3, 4 |
| **Muy recomendado** | 5, 6, 7, 8 |
| **Si el tiempo alcanza** | 9 al 16 |
| **Operativo/optimización** | 17 al 23 |
