-- Segunda parte del apellido y del nombre del agente.
-- La base ya tenía el nombre y el apellido separados; se agregan 2 columnas
-- nuevas (opcionales) para completar los 4 datos:
--   APELLIDO_AGENTE | SEGUNDO_APELLIDO_AGENTE | NOMBRE_AGENTE | SEGUNDO_NOMBRE_AGENTE
-- El nombre completo se compone en la app como
--   APELLIDO [2º APELLIDO] NOMBRE [2º NOMBRE]

IF COL_LENGTH('DATOS_PERSONALES_AGENTE_JUBILA', 'SEGUNDO_APELLIDO_AGENTE') IS NULL
BEGIN
  ALTER TABLE [dbo].[DATOS_PERSONALES_AGENTE_JUBILA]
    ADD [SEGUNDO_APELLIDO_AGENTE] varchar(255) NULL;
END;

IF COL_LENGTH('DATOS_PERSONALES_AGENTE_JUBILA', 'SEGUNDO_NOMBRE_AGENTE') IS NULL
BEGIN
  ALTER TABLE [dbo].[DATOS_PERSONALES_AGENTE_JUBILA]
    ADD [SEGUNDO_NOMBRE_AGENTE] varchar(255) NULL;
END;