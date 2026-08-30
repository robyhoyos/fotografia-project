// src/main/handlers/database.handler.ts
// Handler IPC para operaciones de base de datos (backup/restore/estado).
// La lógica de integridad y seguridad vive en database.service.ts:
//  - Backup: validación + registro del último respaldo
//  - Restore: validación SQLite + respaldo de seguridad automático
//  - Info: tamaño, conteos y última fecha de respaldo

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import {
  createBackup,
  restoreDatabase,
  getDatabaseInfo,
} from '../services/database.service'

const channels = IPC_CHANNELS.DATABASE

/**
 * @function registerDatabaseHandlers
 * @description Registra los handlers IPC para backup/restore del BD.
 *
 * Flujo de Backup:
 * 1. Renderer llama window.api.database.backup()
 * 2. Main abre dialog.showSaveDialog para elegir destino
 * 3. Service registra last_backup_at y copia dev.db → destino
 *
 * Flujo de Restore:
 * 1. Renderer llama window.api.database.restore()
 * 2. Main abre dialog.showOpenDialog para elegir archivo .db
 * 3. Service valida firma SQLite y crea respaldo de seguridad automático
 * 4. Cierra Prisma, copia archivo → dev.db, reconecta Prisma
 * 5. Retorna éxito
 */
export function registerDatabaseHandlers() {
  // ─── Backup ───────────────────────────────────────────────
  ipcMain.handle(channels.BACKUP, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return { success: false, error: 'No se encontró la ventana principal' }
      }

      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')
      const defaultName = `fotoapp-backup-${timestamp}.db`

      const result = await dialog.showSaveDialog(win, {
        title: 'Guardar respaldo de base de datos',
        defaultPath: defaultName,
        filters: [
          { name: 'Base de datos SQLite', extensions: ['db'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Operación cancelada por el usuario' }
      }

      const data = await createBackup(result.filePath)

      return {
        success: true,
        data,
        message: `Respaldo creado exitosamente (${data.size})`,
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Restore ──────────────────────────────────────────────
  ipcMain.handle(channels.RESTORE, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return { success: false, error: 'No se encontró la ventana principal' }
      }

      const result = await dialog.showOpenDialog(win, {
        title: 'Seleccionar respaldo para restaurar',
        filters: [
          { name: 'Base de datos SQLite', extensions: ['db'] },
          { name: 'Todos los archivos', extensions: ['*'] },
        ],
        properties: ['openFile'],
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: false, error: 'Operación cancelada por el usuario' }
      }

      const data = await restoreDatabase(result.filePaths[0])

      return {
        success: true,
        data,
        message: `Base de datos restaurada exitosamente (${data.size})`,
      }
    } catch (err) {
      // Reintentar reconexión de Prisma en caso de error (el service desconectó).
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Info ─────────────────────────────────────────────────
  ipcMain.handle(channels.GET_INFO, async () => {
    try {
      return { success: true, data: await getDatabaseInfo() }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
