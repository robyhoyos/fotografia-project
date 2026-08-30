// src/main/handlers/dialog.handler.ts
// Handler IPC para diálogos nativos del sistema.
// Permite al renderer solicitar selección de carpetas sin acceso a Node.js.

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/types/ipc'

const channels = IPC_CHANNELS.DIALOG

export function registerDialogHandlers() {
  /**
   * @description Abre el diálogo nativo para elegir una carpeta.
   * @returns ApiResponse<string | null> con la ruta seleccionada (null si se canceló).
   */
  ipcMain.handle(channels.PICK_DIRECTORY, async (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return { success: false, error: 'No se encontró la ventana principal' }
      }

      const result = await dialog.showOpenDialog(win, {
        title: 'Seleccionar carpeta',
        properties: ['openDirectory', 'createDirectory'],
      })

      if (result.canceled || !result.filePaths[0]) {
        return { success: true, data: null }
      }

      return { success: true, data: result.filePaths[0] }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}