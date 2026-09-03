const { PrismaClient } = require('@prisma/client')
require('dotenv').config()
const prisma = new PrismaClient()

async function test() {
  console.time('query')
  const hoy = new Date()
  const hace30Dias = new Date(hoy)
  hace30Dias.setDate(hoy.getDate() - 30)
  const en30Dias = new Date(hoy)
  en30Dias.setDate(hoy.getDate() + 30)

  const agentes = await prisma.dATOS_PERSONALES_AGENTE_JUBILA.findMany({
    where: {
      ESTADO_ACTIVO: true,
      FECHA_ESTIMADA_JUBILACI_N_ORDINARIA: {
        gte: hace30Dias,
        lte: en30Dias,
      },
    },
    take: 100
  })
  console.timeEnd('query')
  console.log('Result count:', agentes.length)
  await prisma.$disconnect()
}

test()
