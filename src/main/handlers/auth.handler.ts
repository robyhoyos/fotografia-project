// src/main/handlers/auth.handler.ts
// Handler IPC para autenticación y administración de usuarios.
// Expone los canales AUTH.* usando la instancia compartida de AuthService.
//
// NOTA: Los canales de auth NO llevan requireRole porque gestionar la propia
// sesión (login/logout/cambiar contraseña) está permitido para cualquier
// usuario. Las operaciones de administración (createUser/listUsers/toggleUser)
// se validan internamente en el AuthService mediante assertAdmin().

import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import type { ApiResponse } from '../../../shared/types/ipc'
import { getAuthService } from '../auth/permissions'

const channels = IPC_CHANNELS.AUTH

// ─── Schemas de validación ──────────────────────────────────────────

const SetupAdminSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(6).max(128),
  displayName: z.string().max(80).nullable().optional(),
})

const LoginSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(1).max(128),
})

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(6).max(128),
})

const CreateUserSchema = z.object({
  username: z.string().min(1).max(50),
  password: z.string().min(6).max(128),
  role: z.enum(['ADMIN', 'AYUDANTE']),
  displayName: z.string().max(80).nullable().optional(),
})

const ToggleUserSchema = z.object({
  userId: z.string().cuid(),
  isActive: z.boolean(),
})

/**
 * @function registerAuthHandlers
 * @description Registra los handlers IPC de autenticación.
 */
export function registerAuthHandlers(): void {
  // ─── Setup del admin inicial (primer arranque) ──────────────
  ipcMain.handle(
    channels.SETUP_ADMIN,
    async (_event, payload): Promise<ApiResponse<any>> => {
      try {
        const data = SetupAdminSchema.parse(payload)
        const user = await getAuthService().setupAdmin(data)
        return {
          success: true,
          data: user,
          message: 'Administrador creado correctamente',
        }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ─── ¿Hay usuarios creados? ─────────────────────────────────
  ipcMain.handle(channels.IS_SETUP, async (): Promise<ApiResponse<any>> => {
    try {
      const setup = await getAuthService().isSetup()
      return { success: true, data: setup }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Login ──────────────────────────────────────────────────
  ipcMain.handle(
    channels.LOGIN,
    async (_event, payload): Promise<ApiResponse<any>> => {
      try {
        const data = LoginSchema.parse(payload)
        const user = await getAuthService().login(data.username, data.password)
        return { success: true, data: user, message: 'Bienvenido' }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ─── Logout ─────────────────────────────────────────────────
  ipcMain.handle(channels.LOGOUT, async (): Promise<ApiResponse<any>> => {
    try {
      getAuthService().logout()
      return { success: true, message: 'Sesión cerrada' }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Usuario de la sesión activa ────────────────────────────
  ipcMain.handle(channels.GET_CURRENT, async (): Promise<ApiResponse<any>> => {
    try {
      const user = getAuthService().getCurrent()
      return { success: true, data: user }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Cambiar la propia contraseña ───────────────────────────
  ipcMain.handle(
    channels.CHANGE_PASSWORD,
    async (_event, payload): Promise<ApiResponse<any>> => {
      try {
        const data = ChangePasswordSchema.parse(payload)
        await getAuthService().changePassword(data.currentPassword, data.newPassword)
        return { success: true, message: 'Contraseña actualizada' }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ─── Crear usuario (solo ADMIN) ─────────────────────────────
  ipcMain.handle(
    channels.CREATE_USER,
    async (_event, payload): Promise<ApiResponse<any>> => {
      try {
        const data = CreateUserSchema.parse(payload)
        const user = await getAuthService().createUser(data)
        return { success: true, data: user, message: 'Usuario creado' }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ─── Listar usuarios (solo ADMIN) ───────────────────────────
  ipcMain.handle(channels.LIST_USERS, async (): Promise<ApiResponse<any>> => {
    try {
      const data = await getAuthService().listUsers()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Activar/desactivar usuario (solo ADMIN) ────────────────
  ipcMain.handle(
    channels.TOGGLE_USER,
    async (_event, payload): Promise<ApiResponse<any>> => {
      try {
        const data = ToggleUserSchema.parse(payload)
        await getAuthService().toggleUser(data.userId, data.isActive)
        return { success: true, message: 'Estado del usuario actualizado' }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )
}
