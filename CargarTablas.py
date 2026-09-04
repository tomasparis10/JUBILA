import pandas as pd
from sqlalchemy import create_engine
import numpy as np
from datetime import datetime

# -------------------------------------------------------------------
# 1. CONFIGURACIÓN DE RUTAS Y CONEXIÓN
# -------------------------------------------------------------------
ruta_datos_personales = r"C:\Users\julie\OneDrive\Documentos\JUBILA\data\DatosPersonales.xlsx"
ruta_carrera = r"C:\Users\julie\OneDrive\Documentos\JUBILA\data\CarreraAdministrativa.xlsx"

string_conexion = "mssql+pyodbc://usr-wust:Bhq7QLkaC56g@SRV-SQLDEV08/jubila?driver=ODBC+Driver+17+for+SQL+Server&TrustServerCertificate=yes"
engine = create_engine(string_conexion)

# -------------------------------------------------------------------
# 2. PROCESAMIENTO DE DATOS PERSONALES
# -------------------------------------------------------------------
print("Leyendo Excel de Datos Personales...")
df_dp = pd.read_excel(ruta_datos_personales, header=1)

# Limpieza extrema de columnas
df_dp.columns = df_dp.columns.str.strip().str.upper().str.replace(' ', '_')

# --- LA NUEVA LÓGICA DE REGÍMENES CON NORMALIZACIÓN DE PASIVIZADOS ---
def obtener_id_regimen(fila):
    regimen = str(fila['NOMBRE_REGIMEN']).strip().upper()
    sexo = str(fila['SEXO']).strip().upper()
    
    # TRUCO MÁGICO: Si es un pasivizado, le cortamos esa palabra para normalizarlo
    regimen = regimen.replace('PASIVISADOS - ', '').strip()
    
    # Mapeo exacto cruzando con tu tabla de base de datos
    if regimen == 'DOCENTES' and sexo == 'MASCULINO': return 1
    if regimen == 'DOCENTES' and sexo == 'FEMENINO': return 2
    
    if regimen == 'REGIMEN GENERAL' and sexo == 'MASCULINO': return 3
    if regimen == 'REGIMEN GENERAL' and sexo == 'FEMENINO': return 4
    
    # Usamos "in" porque Visma le agrega todo el número de ley (SALUD - SERV. DIF.ART.18 LEY 9504)
    if 'SALUD' in regimen and sexo == 'MASCULINO': return 5
    if 'SALUD' in regimen and sexo == 'FEMENINO': return 6
    
    if regimen == 'UNICO REGIMEN' and sexo == 'MASCULINO': return 7
    if regimen == 'UNICO REGIMEN' and sexo == 'FEMENINO': return 8
    
    return np.nan

# Aplicamos la función fila por fila
df_dp['ID_REGIMEN_JUBILATORIO'] = df_dp.apply(obtener_id_regimen, axis=1)

# --- NORMALIZACIÓN DE FECHAS Y DNI ---
df_dp['FECHA_NACIMIENTO'] = pd.to_datetime(df_dp['FECHA_NACIMIENTO'], dayfirst=True, errors='coerce')

# Forzamos el DNI a entero puro (sin decimales .0 ni letras)
df_dp['DNI_AGENTE'] = pd.to_numeric(df_dp['DNI_AGENTE'], errors='coerce').astype('Int64')

# Columnas requeridas por la DB
columnas_vacias = [
    'ANTIGUEDAD_RECIBO', 
    'ANTIGUEDAD_LICENCIAS', 
    'FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA', 
    'EDAD_ESTIMACION_JUBILACION'
]
for col in columnas_vacias:
    df_dp[col] = np.nan

df_dp_final = df_dp[[
    'ID_REGIMEN_JUBILATORIO', 'DNI_AGENTE', 'NOMBRE_AGENTE', 'APELLIDO_AGENTE', 
    'FECHA_NACIMIENTO', 'SECRETARIA', 'PROGRAMA', 'CARGO', 'SEXO', 
    'ANTIGUEDAD_RECIBO', 'ANTIGUEDAD_LICENCIAS', 'FECHA_ESTIMADA_JUBILACIÓN_ORDINARIA', 
    'EDAD_ESTIMACION_JUBILACION', 'ESTADO_ACTIVO', 'CUIL', 'NUMERO_TELEFONO', 'CORREO_ELECTRONICO'
]]

# Eliminamos duplicados y filas sin DNI por las dudas
df_dp_final = df_dp_final.dropna(subset=['DNI_AGENTE'])
df_dp_final = df_dp_final.drop_duplicates(subset=['DNI_AGENTE'], keep='first')

print(f"Insertando {len(df_dp_final)} Datos Personales únicos en SQL...")
df_dp_final.to_sql('DATOS_PERSONALES_AGENTE_JUBILA', con=engine, if_exists='append', index=False)

# -------------------------------------------------------------------
# 3. PROCESAMIENTO DE CARRERA ADMINISTRATIVA (UPSERT)
# -------------------------------------------------------------------
print("\nLeyendo Excel de Carrera Administrativa...")
df_ca = pd.read_excel(ruta_carrera, header=1)

df_ca.columns = df_ca.columns.str.strip().str.upper()

df_ca = df_ca.rename(columns={
    'EMPLEADO': 'DOCUMENTO_EMPLEADO',
    'FECHA ALTA': 'FECHA_ALTA',
    'FECHA_ALTA': 'FECHA_ALTA',
    'FECHA BAJA': 'FECHA_BAJA',
    'FECHA_BAJA': 'FECHA_BAJA',
    'CAUSA BAJA': 'CAUSA_BAJA',
    'CAUSA_BAJA': 'CAUSA_BAJA'
})

# --- NORMALIZACIÓN ---
df_ca['FECHA_ALTA'] = pd.to_datetime(df_ca['FECHA_ALTA'], dayfirst=True, errors='coerce')
df_ca['FECHA_BAJA'] = pd.to_datetime(df_ca['FECHA_BAJA'], dayfirst=True, errors='coerce')
df_ca['DOCUMENTO_EMPLEADO'] = pd.to_numeric(df_ca['DOCUMENTO_EMPLEADO'], errors='coerce').astype('Int64')

# Descartar filas sin DNI ni FECHA_ALTA (no tienen clave funcional)
df_ca = df_ca.dropna(subset=['DOCUMENTO_EMPLEADO', 'FECHA_ALTA'])

df_ca = df_ca[['DOCUMENTO_EMPLEADO', 'FECHA_ALTA', 'FECHA_BAJA', 'CAUSA_BAJA']].copy()

# Normalizar CAUSA_BAJA: NaN → None para comparar correctamente
df_ca['CAUSA_BAJA'] = df_ca['CAUSA_BAJA'].where(df_ca['CAUSA_BAJA'].notna(), other=None)

print(f"Filas en Excel (con clave válida): {len(df_ca)}")

# --- CARGAR TABLA ACTUAL DESDE LA DB ---
# Traemos solo las columnas que necesitamos para comparar y para identificar el ID a actualizar
print("Cargando tabla CARRERA_ADMINISTRATIVA actual desde la base de datos...")
df_db = pd.read_sql(
    "SELECT ID_CARRERA, DOCUMENTO_EMPLEADO, FECHA_ALTA, FECHA_BAJA, CAUSA_BAJA FROM CARRERA_ADMINISTRATIVA",
    con=engine
)

# Normalizar tipos en df_db para que sean comparables con df_ca
df_db['DOCUMENTO_EMPLEADO'] = pd.to_numeric(df_db['DOCUMENTO_EMPLEADO'], errors='coerce').astype('Int64')
df_db['FECHA_ALTA'] = pd.to_datetime(df_db['FECHA_ALTA'], errors='coerce').dt.normalize()
df_db['FECHA_BAJA'] = pd.to_datetime(df_db['FECHA_BAJA'], errors='coerce').dt.normalize()

# Normalizar FECHA_ALTA del Excel al mismo nivel (sin hora)
df_ca['FECHA_ALTA'] = df_ca['FECHA_ALTA'].dt.normalize()
df_ca['FECHA_BAJA'] = df_ca['FECHA_BAJA'].dt.normalize()

print(f"Fases existentes en la base de datos: {len(df_db)}")

# --- MERGE: identificar qué existe y qué no ---
df_merged = df_ca.merge(
    df_db,
    on=['DOCUMENTO_EMPLEADO', 'FECHA_ALTA'],
    how='left',
    suffixes=('_excel', '_db')
)

# Separar en nuevas vs existentes
mask_nueva = df_merged['ID_CARRERA'].isna()
df_nuevas   = df_merged[mask_nueva].copy()
df_existentes = df_merged[~mask_nueva].copy()

# --- INSERTAR NUEVAS FASES ---
if len(df_nuevas) > 0:
    df_insertar = df_nuevas[['DOCUMENTO_EMPLEADO', 'FECHA_ALTA', 'FECHA_BAJA_excel', 'CAUSA_BAJA_excel']].copy()
    df_insertar = df_insertar.rename(columns={
        'FECHA_BAJA_excel': 'FECHA_BAJA',
        'CAUSA_BAJA_excel': 'CAUSA_BAJA',
    })
    df_insertar['FECHA_CREACION'] = datetime.now()
    df_insertar.to_sql('CARRERA_ADMINISTRATIVA', con=engine, if_exists='append', index=False)
    print(f"  → Nuevas fases insertadas: {len(df_insertar)}")
else:
    print("  → Sin nuevas fases para insertar.")

# --- ACTUALIZAR FASES EXISTENTES CON CAMBIOS ---
actualizados = 0
sin_cambios  = 0

with engine.begin() as conn:
    for _, fila in df_existentes.iterrows():
        # Comparar FECHA_BAJA
        fb_excel = fila['FECHA_BAJA_excel']
        fb_db    = fila['FECHA_BAJA_db']
        fechas_iguales = (pd.isna(fb_excel) and pd.isna(fb_db)) or (
            not pd.isna(fb_excel) and not pd.isna(fb_db) and fb_excel == fb_db
        )

        # Comparar CAUSA_BAJA (tratando NaN y None como equivalentes)
        cb_excel = fila['CAUSA_BAJA_excel'] if not pd.isna(fila['CAUSA_BAJA_excel']) else None
        cb_db    = fila['CAUSA_BAJA_db']    if not pd.isna(fila['CAUSA_BAJA_db'])    else None
        causas_iguales = (cb_excel == cb_db)

        if fechas_iguales and causas_iguales:
            sin_cambios += 1
            continue

        # Hay diferencia → actualizar SOLO esta fase por su ID_CARRERA
        # NUNCA actualizar por DOCUMENTO_EMPLEADO solo (pisaría todo el historial)
        conn.execute(
            """
            UPDATE CARRERA_ADMINISTRATIVA
            SET FECHA_BAJA = :fb, CAUSA_BAJA = :cb
            WHERE ID_CARRERA = :id
            """,
            {
                'fb': None if pd.isna(fb_excel) else fb_excel.to_pydatetime(),
                'cb': cb_excel,
                'id': int(fila['ID_CARRERA']),
            }
        )
        actualizados += 1

print(f"  → Fases actualizadas: {actualizados}")
print(f"  → Fases sin cambios:  {sin_cambios}")
print(f"\n¡Migración de Carrera Administrativa completada!")
print(f"   Nuevas: {len(df_nuevas)} | Actualizadas: {actualizados} | Sin cambios: {sin_cambios}")