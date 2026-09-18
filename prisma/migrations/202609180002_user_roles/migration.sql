-- Agrega columna ROL (un solo rol por usuario: 'ADMIN' | 'JUBILA')
IF COL_LENGTH('USUARIO', 'ROL') IS NULL
BEGIN
  ALTER TABLE [USUARIO]
  ADD [ROL] varchar(20) NOT NULL
      CONSTRAINT [DF_USUARIO_ROL] DEFAULT 'JUBILA';
END;

-- El usuario 'admin' queda como único ADMIN por defecto.
UPDATE [USUARIO] SET [ROL] = 'ADMIN' WHERE [NOMBRE_USUARIO] = 'admin';