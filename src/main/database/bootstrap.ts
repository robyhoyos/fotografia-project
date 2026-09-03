// src/main/database/bootstrap.ts
// Arranque de la ruta de la base de datos.
//
// Este módulo se importa de forma EXPLÍCITA como la primera dependencia en
// index.ts (antes que ./database/prisma). Al ejecutarse, setea
// process.env.DATABASE_URL a una ruta absoluta y escribible ANTES de que
// PrismaClient se construya en prisma.ts, de modo que el datasource
// (env("DATABASE_URL")) resuelva al archivo correcto en producción.

import { ensureDatabaseDir, getDatabasePath, isPackaged } from './paths'

// Asegurar que la carpeta de la BD exista (siempre, para crear userData en prod).
ensureDatabaseDir()

// Generar una URL tipo file: que Prisma logre abrir dentro del runtime Electron.
//
// IMPORTANTE: pathToFileURL().toString() devuelve "file:///C:/..." (triple-slash
// con autoridad vacía). PrismaClient NO logra abrir esa forma dentro de Electron
// ("Error code 14: Unable to open the database file"). La forma correcta es
// "file:C:/..." (dominio o path nativo tras el colon, con slashes hacia delante),
// que funciona tanto en Node como en Electron.
//
// Convertimos la ruta absoluta del SO a barras hacia delante y la prefijamos con
// "file:". En Windows:  "C:\...\prisma\dev.db"  ->  "file:C:/.../prisma/dev.db".
// En POSIX:            "/users/.../dev.db"     ->  "file:/users/.../dev.db".
const absolutePath = getDatabasePath().replace(/\\/g, '/')
process.env.DATABASE_URL = `file:${absolutePath}`

// Loguear (solo empaquetado) la ubicación real de la BD para diagnóstico.
if (isPackaged()) {
  console.info(`[Main] Base de datos: ${getDatabasePath()}`)
}

export {}
