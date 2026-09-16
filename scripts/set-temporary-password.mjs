import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const [username, temporaryPassword] = process.argv.slice(2)
if (!username || !temporaryPassword || temporaryPassword.length < 5 || temporaryPassword.length > 25) {
  console.error('Uso: npm run set-temporary-password -- USUARIO "Clave5a25"')
  process.exitCode = 1
} else {
  const prisma = new PrismaClient()
  try {
    const hash = await bcrypt.hash(temporaryPassword, 12)
    const result = await prisma.uSUARIO.updateMany({
      where: { NOMBRE_USUARIO: username },
      data: { CONTRASENA_USUARIO: hash, DEBE_CAMBIAR_CONTRASENA: true },
    })
    if (result.count !== 1) {
      console.error('No se encontró un único usuario con ese nombre.')
      process.exitCode = 1
    } else {
      console.log('Clave temporal asignada. No se muestra ni se almacena en texto plano.')
    }
  } finally { await prisma.$disconnect() }
}
