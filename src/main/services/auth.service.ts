// src/main/services/auth.service.ts
// Service de autenticación y sesión.
// Maneja el login/logout, la creación del administrador inicial (primer arranque),
// el cambio de contraseñas y la administración de usuarios con roles.
//
// @security
// - Las contraseñas se guardan SIEMPRE como hash bcrypt (nunca en texto plano).
// - El hash nunca se expone al renderer.
// - La sesión activa vive solo en memoria del Main process (app local de escritorio).

import { UserRole } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { UserRepository } from '../repositories/user.repository'
import type { AuthUser, AppRole } from '../../../shared/types/ipc'

const SALT_ROUNDS = 10

/**
 * @class AuthService
 * @description Maneja toda la lógica de autenticación y control de sesión.
 */
export class AuthService {
  private repository: UserRepository
  private currentUser: AuthUser | null = null

  constructor(repository: UserRepository) {
    this.repository = repository
  }

  // ─── Helpers de hash ─────────────────────────────────────────

  async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, SALT_ROUNDS)
  }

  async verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash)
  }

  // ─── Primer arranque ─────────────────────────────────────────

  /**
   * @description Indica si la aplicación ya tiene al menos un usuario activo.
   * (Si no hay ninguno, el renderer muestra el formulario de setup del admin inicial).
   */
  async isSetup(): Promise<boolean> {
    return (await this.repository.countActive()) > 0
  }

  /**
   * @description Crea el administrador inicial en el primer arranque.
   * Solo es posible cuando aún no existe ningún usuario.
   */
  async setupAdmin(input: {
    username: string
    password: string
    displayName?: string | null
  }): Promise<AuthUser> {
    if (await this.isSetup()) {
      throw new Error('La aplicación ya tiene un administrador configurado')
    }

    const username = input.username.trim().toLowerCase()
    if (!username) throw new Error('El nombre de usuario es obligatorio')
    if (input.password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres')
    }

    const passwordHash = await this.hashPassword(input.password)
    const user = await this.repository.create({
      username,
      passwordHash,
      role: UserRole.ADMIN,
      displayName: input.displayName?.trim() || null,
    })

    const authUser = this.toAuthUser(user)
    this.currentUser = authUser
    return authUser
  }

  // ─── Sesión ──────────────────────────────────────────────────

  /**
   * @description Inicia sesión validando credenciales.
   */
  async login(username: string, password: string): Promise<AuthUser> {
    const normalized = username.trim().toLowerCase()
    const user = await this.repository.findByUsername(normalized)

    if (!user || !user.isActive) {
      throw new Error('Credenciales inválidas o usuario inactivo')
    }

    const valid = await this.verifyPassword(password, user.passwordHash)
    if (!valid) {
      throw new Error('Credenciales inválidas o usuario inactivo')
    }

    const authUser = this.toAuthUser(user)
    this.currentUser = authUser
    return authUser
  }

  /**
   * @description Recupera el usuario de la sesión activa (si existe).
   */
  getCurrent(): AuthUser | null {
    return this.currentUser
  }

  /**
   * @description Cierra la sesión activa.
   */
  logout(): void {
    this.currentUser = null
  }

  /**
   * @description Indica si hay una sesión activa.
   */
  isAuthenticated(): boolean {
    return this.currentUser !== null
  }

  // ─── Administración de usuarios (solo ADMIN) ────────────────

  /**
   * @description Cambia la contraseña del usuario autenticado.
   * Requiere verificar la contraseña actual.
   */
  async changePassword(current: string, next: string): Promise<void> {
    if (!this.currentUser) throw new Error('No hay sesión activa')

    const user = await this.repository.findById(this.currentUser.id)
    if (!user) throw new Error('Usuario no encontrado')

    const valid = await this.verifyPassword(current, user.passwordHash)
    if (!valid) throw new Error('La contraseña actual es incorrecta')

    if (!next || next.length < 6) {
      throw new Error('La nueva contraseña debe tener al menos 6 caracteres')
    }

    const hash = await this.hashPassword(next)
    await this.repository.updatePassword(user.id, hash)
  }

  /**
   * @description Crea un nuevo usuario (solo ADMIN).
   */
  async createUser(input: {
    username: string
    password: string
    role: AppRole
    displayName?: string | null
  }): Promise<AuthUser> {
    this.assertAdmin()

    const username = input.username.trim().toLowerCase()
    if (!username) throw new Error('El nombre de usuario es obligatorio')
    if (input.password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres')
    }

    const existing = await this.repository.findByUsername(username)
    if (existing) {
      throw new Error('El nombre de usuario ya existe')
    }

    const role = input.role === 'AYUDANTE' ? UserRole.AYUDANTE : UserRole.ADMIN
    const passwordHash = await this.hashPassword(input.password)
    const user = await this.repository.create({
      username,
      passwordHash,
      role,
      displayName: input.displayName?.trim() || null,
    })

    return this.toAuthUser(user)
  }

  /**
   * @description Lista todos los usuarios con su estado (solo ADMIN).
   */
  async listUsers() {
    this.assertAdmin()
    const users = await this.repository.findMany()
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      role: u.role as AppRole,
      displayName: u.displayName,
      isActive: u.isActive,
      createdAt: u.createdAt.toISOString(),
    }))
  }

  /**
   * @description Activa/desactiva un usuario (solo ADMIN).
   * Nunca permite desactivar el último administrador activo ni a sí mismo.
   */
  async toggleUser(id: string, isActive: boolean): Promise<void> {
    this.assertAdmin()

    if (this.currentUser && this.currentUser.id === id) {
      throw new Error('No puedes desactivar tu propio usuario')
    }

    const target = await this.repository.findById(id)
    if (!target) throw new Error('Usuario no encontrado')

    // Evitar desactivar el último admin activo
    if (target.role === UserRole.ADMIN && !isActive) {
      const admins = await this.repository.findMany()
      const activeAdmins = admins.filter(
        (u) => u.role === UserRole.ADMIN && u.isActive
      )
      if (activeAdmins.length <= 1) {
        throw new Error('No puedes desactivar el último administrador')
      }
    }

    await this.repository.toggleActive(id, isActive)
  }

  // ─── Helpers ────────────────────────────────────────────────

  private assertAdmin(): void {
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      throw new Error('Se requiere rol de administrador')
    }
  }

  private toAuthUser(user: {
    id: string
    username: string
    role: UserRole
    displayName: string | null
  }): AuthUser {
    return {
      id: user.id,
      username: user.username,
      role: user.role as AppRole,
      displayName: user.displayName,
    }
  }
}
