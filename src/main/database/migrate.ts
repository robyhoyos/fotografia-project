// src/main/database/migrate.ts
// Aplicación de migraciones de Prisma en PRODUCCIÓN (app empaquetada).
//
// En desarrollo las migraciones se aplican a mano con `npm run prisma:migrate`
// (prisma migrate dev). En el instalador del cliente NO existe ese paso,
// por lo que al arrancar la app empaquetada se debe ejecutar `prisma migrate deploy`
// para que una instalación nueva cree la BD y una actualización aplique los
// cambios de esquema SIN perder los datos existentes.
//
// `prisma migrate deploy`:
//  - Es NO interactivo (no pide confirmación), ideal para un arranque automático.
//  - Aplica únicamente las migraciones pendientes (nunca ejecuta DROP ni borra filas).
//  - Es idempotente: en una BD al día simplemente no aplica nada.
//
// El CLI de Prisma se ejecuta como subproceso usando el propio binario de
// Electron en modo Node puro (ELECTRON_RUN_AS_NODE=1) contra el CLI empaquetado
// en `resources/app/node_modules/prisma/build/index.js` (ver electron-builder.yml:
// `prisma` vive en `dependencies` para que electron-builder lo incluya).

import { app } from 'electron'
import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'
import { getDatabasePath, isPackaged } from './paths'

/**
 * @function resolveDataSourceUrl
 * @description Devuelve la URL file: de la BD en uso, en la misma forma
 * ("file:C:/...") que bootstrap.ts genera antes de construir PrismaClient.
 */
function resolveDataSourceUrl(): string {
  return `file:${getDatabasePath().replace(/\\/g, '/')}`
}

/**
 * @function runPrismaMigrateDeploy
 * @description Ejecuta `prisma migrate deploy` contra la BD de producción.
 * Solo actúa cuando la app está empaquetada; en desarrollo no hace nada
 * (se migra manualmente con `npm run prisma:migrate`).
 *
 * Se invoca ANTES de `prisma.$connect()`. Si falla se loguea el error pero la
 * app continúa el arranque para no dejarla inoperante (el fallo suele deberse a
 * un entorno sin permisos o a un CLI ausente en builds antiguos).
 */
export async function applyMigrations(): Promise<void> {
  if (!isPackaged()) {
    console.info('[Migrate] En desarrollo, se omiten migraciones (se usan con npm run prisma:migrate)')
    return
  }

  const cliPath = path.join(
    app.getAppPath(),
    'node_modules',
    'prisma',
    'build',
    'index.js',
  )
  const schemaPath = path.join(process.resourcesPath, 'prisma', 'schema.prisma')

  if (!fs.existsSync(cliPath)) {
    console.warn('[Migrate] CLI de Prisma no encontrado en el build:', cliPath)
    return
  }
  if (!fs.existsSync(schemaPath)) {
    console.warn('[Migrate] Schema de Prisma no encontrado en el build:', schemaPath)
    return
  }

  console.info('[Migrate] Aplicando migraciones de base de datos...')
  await new Promise<void>((resolve) => {
    execFile(
      process.execPath,
      [cliPath, 'migrate', 'deploy', '--schema', schemaPath],
      {
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: '1',
          DATABASE_URL: resolveDataSourceUrl(),
        },
        windowsHide: true,
        cwd: path.dirname(schemaPath),
      },
      (error, stdout, stderr) => {
        if (stdout) console.info('[Migrate] ' + stdout.trim())
        if (stderr) console.info('[Migrate] ' + stderr.trim())
        if (error) {
          console.warn('[Migrate] No se pudieron aplicar migraciones:', error.message)
        } else {
          console.info('[Migrate] Migraciones aplicadas correctamente')
        }
        resolve()
      },
    )
  })
}
