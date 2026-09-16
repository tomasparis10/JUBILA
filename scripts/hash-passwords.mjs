import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
try {
  const users = await prisma.uSUARIO.findMany({ select: { ID_USUARIO: true, CONTRASENA_USUARIO: true } })
  for (const user of users) {
    if (user.CONTRASENA_USUARIO.startsWith('$2a$') || user.CONTRASENA_USUARIO.startsWith('$2b$') || user.CONTRASENA_USUARIO.startsWith('$2y$')) continue
    await prisma.uSUARIO.update({ where: { ID_USUARIO: user.ID_USUARIO }, data: { CONTRASENA_USUARIO: await bcrypt.hash(user.CONTRASENA_USUARIO, 12) } })
  }
  console.log(`Contraseñas convertidas: ${users.length}`)
} finally { await prisma.$disconnect() }
