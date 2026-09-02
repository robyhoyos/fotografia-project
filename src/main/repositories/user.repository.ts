// src/main/repositories/user.repository.ts
// Repository para usuarios y roles.
// Acceso a datos sobre la tabla User (autenticación y administración).

import { UserRole } from '@prisma/client'
import prisma from '../database/prisma'

export interface UserRow {
  id: string
  username: string
  passwordHash: string
  role: UserRole
  displayName: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class UserRepository {
  /**
   * @description Cuenta los usuarios activos (para detectar primer arranque).
   */
  async countActive(): Promise<number> {
    return prisma.user.count({ where: { isActive: true } })
  }

  /**
   * @description Busca un usuario por nombre de usuario (para login).
   */
  async findByUsername(username: string): Promise<UserRow | null> {
    return prisma.user.findUnique({ where: { username } })
  }

  /**
   * @description Obtiene el hash de contraseña de un usuario por id (para cambio de contraseña).
   */
  async findById(id: string): Promise<UserRow | null> {
    return prisma.user.findUnique({ where: { id } })
  }

  /**
   * @description Crea un usuario.
   */
  async create(data: {
    username: string
    passwordHash: string
    role: UserRole
    displayName?: string | null
  }): Promise<UserRow> {
    return prisma.user.create({
      data: {
        username: data.username,
        passwordHash: data.passwordHash,
        role: data.role,
        displayName: data.displayName ?? null,
      },
    })
  }

  /**
   * @description Actualiza la contraseña de un usuario.
   */
  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    })
  }

  /**
   * @description Activa/desactiva un usuario. No permite desactivar el último admin.
   */
  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await prisma.user.update({ where: { id }, data: { isActive } })
  }

  /**
   * @description Lista todos los usuarios (para administración).
   */
  async findMany(): Promise<UserRow[]> {
    return prisma.user.findMany({
      orderBy: [{ role: 'asc' }, { username: 'asc' }],
    })
  }
}
