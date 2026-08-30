// src/main/repositories/settings.repository.ts
// Repository para configuraciones de la aplicación.
// Almacena pares clave-valor en la tabla Setting.

import prisma from '../database/prisma'

export interface SettingRecord {
  key: string
  value: string
  category: string
  label: string
  description: string | null
}

export class SettingsRepository {
  /**
   * @description Obtiene todas las configuraciones agrupadas por categoría.
   */
  async findAll(): Promise<Record<string, SettingRecord[]>> {
    const settings = await prisma.setting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    })

    const grouped: Record<string, SettingRecord[]> = {}
    for (const s of settings) {
      if (!grouped[s.category]) {
        grouped[s.category] = []
      }
      grouped[s.category].push({
        key: s.key,
        value: s.value,
        category: s.category,
        label: s.label,
        description: s.description,
      })
    }
    return grouped
  }

  /**
   * @description Obtiene una configuración por su clave.
   */
  async findByKey(key: string): Promise<string | null> {
    const setting = await prisma.setting.findUnique({
      where: { key },
      select: { value: true },
    })
    return setting?.value ?? null
  }

  /**
   * @description Obtiene múltiples configuraciones por sus claves.
   */
  async findByKeys(keys: string[]): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    })

    const result: Record<string, string> = {}
    for (const s of settings) {
      result[s.key] = s.value
    }
    return result
  }

  /**
   * @description Upsert de una configuración.
   */
  async upsert(
    key: string,
    value: string,
    label: string,
    category: string,
    description?: string
  ): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value, label, category, description },
      create: { key, value, label, category, description },
    })
  }

  /**
   * @description Upsert de múltiples configuraciones en lote.
   */
  async upsertMany(
    items: Array<{
      key: string
      value: string
      label: string
      category: string
      description?: string
    }>
  ): Promise<void> {
    const operations = items.map((item) =>
      prisma.setting.upsert({
        where: { key: item.key },
        update: { value: item.value, label: item.label, category: item.category, description: item.description },
        create: {
          key: item.key,
          value: item.value,
          label: item.label,
          category: item.category,
          description: item.description,
        },
      })
    )
    await prisma.$transaction(operations)
  }

  /**
   * @description Actualiza solo la metadata (categoría, etiqueta, descripción)
   * de una configuración sin modificar su valor actual.
   */
  async updateMetadata(
    key: string,
    data: { category: string; label: string; description: string }
  ): Promise<void> {
    await prisma.setting.update({
      where: { key },
      data: {
        category: data.category,
        label: data.label,
        description: data.description,
      },
    })
  }

  /**
   * @description Elimina una configuración.
   */
  async delete(key: string): Promise<void> {
    await prisma.setting.delete({ where: { key } })
  }

  /**
   * @description Elimina todas las configuraciones de una categoría.
   */
  async deleteByCategory(category: string): Promise<void> {
    await prisma.setting.deleteMany({ where: { category } })
  }
}
