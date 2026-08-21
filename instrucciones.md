# Contexto del Proyecto
Actúa como un desarrollador Senior experto en Next.js (App Router), TypeScript y Prisma ORM.

Tengo un sistema cuyo frontend ya está maquetado. Acabo de migrar exitosamente los datos semilla a una base de datos **SQL Server** existente. Necesito que analices en profundidad mi código actual y conectes las vistas con esta base de datos real.

# Plan de Acción

## 1. Configuración de Prisma y Base de Datos
* Analiza mi código e inicializa Prisma configurado específicamente para `sqlserver`.
* Indícame cómo configurar mi archivo `.env` utilizando esta estructura base: `sqlserver://SRV-SQLDEV08;database=jubila;user=usr-wust;password=[TU_PASSWORD];trustServerCertificate=true`
* Como la base de datos ya tiene estructura y datos reales (tablas como DATOS_PERSONALES_AGENTE_JUBILA, BENEFICIO, REGIMEN_JUBILATORIO), guíame para ejecutar la introspección (`prisma db pull`) y generar el `schema.prisma` automáticamente sin romper lo existente.

## 2. Desarrollo de la Lógica de Servidor
* Revisa mis componentes actuales para entender qué información consume la interfaz (por ejemplo, el cálculo de antigüedad, el cruce entre el Agente, su Régimen y sus Fases).
* Crea los Server Actions (recomendado) o Route Handlers (`app/api/...`) necesarios para extraer estos datos de SQL Server utilizando Prisma Client.

## 3. Integración y Reemplazo en el Frontend (REGLA ESTRICTA)
* Identifica los componentes React que actualmente tienen datos estáticos, mockeados o hardcodeados.
* Modifica estos componentes para que ejecuten las llamadas al nuevo backend.
* **PROHIBICIÓN DE DATOS MOCKEADOS:** Bajo ninguna circunstancia debes dejar datos mockeados, hardcodeados o estáticos en el código final. Si un campo o dato que requiere el frontend aún no existe o no está disponible en la base de datos, debes manejarlo estrictamente como nulo, indefinido o estado vacío (`null`, `undefined` o `""`), pero nunca inventar ni rellenar con datos falsos.
* Implementa un manejo de estados de carga (`loading`) y captura de errores en la interfaz para mantener una buena experiencia de usuario.

Por favor, confirma que entendiste el flujo de trabajo y dime cuál es el primer paso exacto o comando que debemos ejecutar para arrancar.