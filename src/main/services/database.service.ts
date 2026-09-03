// src/main/services/database.service.ts
// Service para operaciones de base de datos SQLite (backup/restore/estado).
// Aporta integridad y seguridad que el flujo original no cubría:
//  - Valida que el archivo a restaurar sea una BD SQLite real (firma de 16 bytes)
//  - Crea un respaldo de seguridad automático de la BD actual antes de sobrescribir
//  - Persiste la fecha del último respaldo y la expone vía estado de BD
// Nota: la BD usa journal mode DELETE (no WAL), por lo que dev.db ya es completo.

import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import prisma from '../database/prisma'
import { getDatabasePath } from '../database/paths'

// Firma mágica de SQLite: los 16 primeros bytes de TODO archivo .db válido.
const SQLITE_HEADER = Buffer.from('SQLite format 3\u0000')

/**
 * @function formatBytes
 * @description Formatea bytes a KB/MB/GB legibles.
 */
export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * @function isSQLiteFile
 * @description Valida que un archivo tenga la firma de una BD SQLite real.
 * Evita restaurar archivos corruptos o que no son una base de datos.
 */
export function isSQLiteFile(filePath: string): boolean {
  try {
    const fd = fs.openSync(filePath, 'r')
    const buf = Buffer.alloc(16)
    const read = fs.readSync(fd, buf, 0, 16, 0)
    fs.closeSync(fd)
    return read === 16 && buf.equals(SQLITE_HEADER)
  } catch {
    return false
  }
}

/**
 * @function getSafetyBackupsDir
 * @description Carpeta donde se guardan los respaldos de seguridad automáticos.
 * Se almacena en userData (fuera del proyecto) para no mezclarse con el código.
 */
function getSafetyBackupsDir(): string {
  return path.join(app.getPath('userData'), 'backups')
}

/**
 * @function setLastBackupAt / getLastBackupAt
 * @description Persiste/lee la fecha del último respaldo en la tabla Setting.
 */
async function setLastBackupAt(iso: string): Promise<void> {
  try {
    await prisma.setting.upsert({
      where: { key: 'last_backup_at' },
      update: { value: iso },
      create: {
        key: 'last_backup_at',
        value: iso,
        label: 'Último respaldo',
        category: 'system',
        description: 'Fecha ISO del último respaldo manual creado',
      },
    })
  } catch {
    // no bloquea el respaldo si falla la anotación
  }
}

async function getLastBackupAt(): Promise<string | null> {
  try {
    const row = await prisma.setting.findUnique({
      where: { key: 'last_backup_at' },
      select: { value: true },
    })
    return row?.value ?? null
  } catch {
    return null
  }
}

/**
 * @function createBackup
 * @description Crea un respaldo de la BD actual en `filePath` (elegido por el usuario).
 */
export async function createBackup(filePath: string): Promise<{
  path: string
  size: string
  lastBackupAt: string
}> {
  const dbPath = getDatabasePath()
  if (!fs.existsSync(dbPath)) {
    throw new Error('No se encontró la base de datos')
  }

  fs.copyFileSync(dbPath, filePath)

  const lastBackupAt = new Date().toISOString()
  await setLastBackupAt(lastBackupAt)

  return {
    path: filePath,
    size: formatBytes(fs.statSync(filePath).size),
    lastBackupAt,
  }
}

/**
 * @function restoreDatabase
 * @description Restaura la BD desde un archivo seleccionado por el usuario.
 * Antes de sobrescribir: valida que el archivo sea SQLite y crea un respaldo
 * de seguridad automático de la BD actual para poder recuperarse si algo falla.
 */
export async function restoreDatabase(sourcePath: string): Promise<{
  size: string
  safetyBackup: string
}> {
  const dbPath = getDatabasePath()

  if (!fs.existsSync(sourcePath)) {
    throw new Error('El archivo seleccionado no existe')
  }
  if (fs.statSync(sourcePath).size === 0) {
    throw new Error('El archivo seleccionado está vacío')
  }
  if (!isSQLiteFile(sourcePath)) {
    throw new Error('El archivo no es una base de datos SQLite válida')
  }

  // Respaldar la BD actual antes de sobrescribir (red de seguridad).
  const backupsDir = getSafetyBackupsDir()
  fs.mkdirSync(backupsDir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[T:]/g, '-').replace(/\..+/, '')
  const safetyPath = path.join(backupsDir, `pre-restore-${stamp}.db`)
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, safetyPath)
  }

  // Reemplazar la BD.
  await prisma.$disconnect()
  try {
    fs.copyFileSync(sourcePath, dbPath)
    await prisma.$connect()
  } catch (err) {
    // Si la BD restaurada no tiene el esquema esperado, $connect falla.
    // Se intenta reconectar igualmente para no dejar a Prisma desconectado.
    try {
      await prisma.$connect()
    } catch {
      // sin reconexión posible
    }
    throw err
  }

  return {
    size: formatBytes(fs.statSync(sourcePath).size),
    safetyBackup: safetyPath,
  }
}

/**
 * @function getDatabaseInfo
 * @description Estado de la BD para la UI: tamaño, conteos y último respaldo.
 */
export async function getDatabaseInfo(): Promise<{
  path: string
  exists: boolean
  size: string
  sizeBytes: number
  eventCount: number
  participantCount: number
  lastBackupAt: string | null
}> {
  const dbPath = getDatabasePath()
  const exists = fs.existsSync(dbPath)
  const sizeBytes = exists ? fs.statSync(dbPath).size : 0

  let eventCount = 0
  let participantCount = 0
  if (exists) {
    const [e, p] = await Promise.all([
      prisma.event.count().catch(() => 0),
      prisma.participant.count().catch(() => 0),
    ])
    eventCount = e
    participantCount = p
  }

  const lastBackupAt = await getLastBackupAt()

  return {
    path: dbPath,
    exists,
    size: formatBytes(sizeBytes),
    sizeBytes,
    eventCount,
    participantCount,
    lastBackupAt,
  }
}
