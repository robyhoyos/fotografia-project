// src/main/auth/permissions.ts
// Guardia central de permisos para los handlers IPC.
//
// @security
// En una app Electron, ocultar botones en la UI NO es suficiente: el renderer
// puede invocar cualquier canal expuesto desde la consola. La protección real
// debe vivir en el Main process. Este módulo envuelve cada handler mutador
// para verificar rol y sesión ANTES de ejecutar la lógica de negocio.
//
// Uso:
//   ipcMain.handle(channel, requireRole(['ADMIN'], async (event, payload) => {
//     ... lógica segura ...
//   }))
//
// Si no hay sesión o el rol no está permitido, se devuelve una ApiResponse
// de error sin ejecutar la operación.

import { AuthService } from '../services/auth.service'
import type { ApiResponse, AppRole } from '../../../shared/types/ipc'

let authService: AuthService | null = null

/**
 * @function setAuthService
 * @description Registra la instancia única de AuthService usada por la guardia.
 * Debe llamarse durante la inicialización de servicios en el Main process.
 */
export function setAuthService(service: AuthService): void {
  authService = service
}

/**
 * @function getAuthService
 * @description Retorna el AuthService registrado. Permite a los handlers de
 * autenticación usar la misma instancia de sesión.
 */
export function getAuthService(): AuthService {
  if (!authService) throw new Error('AuthService no inicializado')
  return authService
}

type IpcHandler<TArgs extends unknown[] = unknown[]> = (
  event: Electron.IpcMainInvokeEvent,
  ...args: TArgs
) => unknown

/**
 * @function requireAuth
 * @description Exige que exista una sesión activa. Devuelve error sin ejecutar
 * la lógica si el renderer no ha iniciado sesión.
 */
export function requireAuth<TArgs extends unknown[]>(
  handler: IpcHandler<TArgs>
): IpcHandler<TArgs> {
  return async (event, ...args) => {
    if (!getAuthService().isAuthenticated()) {
      return authError('Debes iniciar sesión para realizar esta acción')
    }
    return handler(event, ...args)
  }
}

/**
 * @function requireRole
 * @description Exige sesión activa y un rol dentro de la lista permitida.
 * Uso: requireRole(['ADMIN'], handler) o requireRole('ADMIN', handler).
 */
export function requireRole<TArgs extends unknown[]>(
  roles: AppRole | AppRole[],
  handler: IpcHandler<TArgs>
): IpcHandler<TArgs> {
  const allowed = Array.isArray(roles) ? roles : [roles]
  return requireAuth<TArgs>(async (event, ...args) => {
    const user = getAuthService().getCurrent()
    if (!user || !allowed.includes(user.role)) {
      return authError('No tienes permisos para realizar esta acción')
    }
    return handler(event, ...args)
  })
}

/**
 * @function requireAdmin
 * @description Atajo para handlers exclusivos de administrador.
 */
export function requireAdmin<TArgs extends unknown[]>(
  handler: IpcHandler<TArgs>
): IpcHandler<TArgs> {
  return requireRole<TArgs>('ADMIN', handler)
}

/**
 * @function requireStaff
 * @description Atajo para handlers permitidos a cualquier rol autenticado
 * (ADMIN y AYUDANTE). Se usa para operaciones operativas cotidianas como
 * registrar/corregir pagos o generar facturas/recibos.
 */
export function requireStaff<TArgs extends unknown[]>(
  handler: IpcHandler<TArgs>
): IpcHandler<TArgs> {
  return requireRole<TArgs>(['ADMIN', 'AYUDANTE'], handler)
}

function authError(error: string): ApiResponse<never> {
  return { success: false, error }
}
