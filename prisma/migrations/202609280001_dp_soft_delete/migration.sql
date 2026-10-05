-- Borrado lógico de agentes: agrega BIT_BORRADO a DATOS_PERSONALES_AGENTE_JUBILA
-- para que al "borrar" un agente la información nunca desaparezca (soft delete),
-- alineado con el comportamiento de ARCHIVO_JUBILACION y JUBILA.

IF COL_LENGTH('DATOS_PERSONALES_AGENTE_JUBILA', 'BIT_BORRADO') IS NULL
BEGIN
  ALTER TABLE [dbo].[DATOS_PERSONALES_AGENTE_JUBILA]
    ADD [BIT_BORRADO] bit NOT NULL
      CONSTRAINT [DF_DATOS_PERSONALES_AGENTE_JUBILA_BIT_BORRADO] DEFAULT 0;
END;