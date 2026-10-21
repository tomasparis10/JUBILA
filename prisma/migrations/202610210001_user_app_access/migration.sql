-- Permisos de acceso a los sistemas JUBILA y Retenciones.
-- Los usuarios existentes conservan acceso a JUBILA; Retenciones queda
-- deshabilitado hasta que un administrador lo habilite para cada usuario.

IF COL_LENGTH('USUARIO', 'JUBILA') IS NULL
BEGIN
  ALTER TABLE [USUARIO]
    ADD [JUBILA] bit NOT NULL
      CONSTRAINT [DF_USUARIO_JUBILA] DEFAULT (1) WITH VALUES;
END;

IF COL_LENGTH('USUARIO', 'RETENCIONES') IS NULL
BEGIN
  ALTER TABLE [USUARIO]
    ADD [RETENCIONES] bit NOT NULL
      CONSTRAINT [DF_USUARIO_RETENCIONES] DEFAULT (0) WITH VALUES;
END;
