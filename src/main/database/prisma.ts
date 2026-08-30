// src/main/database/prisma.ts
// Instancia singleton de Prisma Client.
// Se instancia una sola vez en el Main process y se comparte entre repositories.

import { PrismaClient } from '@prisma/client'

/**
 * @singleton prisma
 * @description Cliente Prisma singleton para evitar múltiples conexiones.
 *
 * Flujo de conexión:
 * 1. App inicia → prisma se instancia en el Main process
 * 2. Cada Repository recibe esta instancia
 * 3. Los handlers IPC llaman a los Services → Services llaman a Repositories
 * 4. Al cerrar la app → prisma.$disconnect() limpia la conexión
 *
 * @security nodeIntegration: false确保el Renderer NUNCA accede a esto.
 * Solo el Main process tiene acceso directo a Prisma.
 */
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export default prisma
