// src/main/database/paths.ts
// Resolución central de la ruta de la base de datos SQLite.
//
// En desarrollo la BD vive dentro del proyecto (prisma/dev.db), como hasta ahora.
// En producción (app empaquetada) NO se puede escribir junto al .exe (Program Files,
// carpetas de instalación), por lo que la BD se guarda en la carpeta de datos del
// usuario (app.getPath('userData')), una ruta estable y escribible.
//
// Estas funciones se agrupan aquí para que prisma.ts (cliente) y database.service.ts
// (backup/restore/estado) apunten siempre al mismo archivo.

import path from 'path'
import fs from 'fs'
import { app } from 'electron'

/**
 * @function isPackaged
 * @description La app está empaquetada (instalada) cuando app.isPackaged es true.
 * @security No confiar en NODE_ENV: electron-builder no siempre lo define.
 */
export function isPackaged(): boolean {
  return app?.isPackaged ?? false
}

/**
 * @function resolveDatabaseDir
 * @description Carpeta donde vive la base de datos.
 * - Desarrollo: <proyecto>/prisma
 * - Producción: userData (ej. C:\Users\<usuario>\AppData\Roaming\fotografia-app)
 */
export function resolveDatabaseDir(): string {
  if (isPackaged()) {
    return app.getPath('userData')
  }
  return path.join(process.cwd(), 'prisma')
}

/**
 * @function getDatabasePath
 * @description Ruta absoluta del archivo de base de datos en uso.
 */
export function getDatabasePath(): string {
  return path.join(resolveDatabaseDir(), 'dev.db')
}

/**
 * @function ensureDatabaseDir
 * @description Garantiza que la carpeta de la BD exista y sea escribible.
 */
export function ensureDatabaseDir(): string {
  const dir = resolveDatabaseDir()
  fs.mkdirSync(dir, { recursive: true })
  return dir
}
