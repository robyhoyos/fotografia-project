// src/main/services/settings.service.ts
// Service para configuraciones de la aplicación.
// Maneja la lógica de negocio y defaults de configuración.

import { nativeImage } from 'electron'
import { SettingsRepository, SettingRecord } from '../repositories/settings.repository'

/** Clave de configuración donde se guarda el logo del negocio (base64 PNG). */
const LOGO_KEY = 'business_logo'

/** Valores por defecto de la aplicación */
export const DEFAULT_SETTINGS: Array<{
  key: string
  value: string
  label: string
  category: string
  description: string
}> = [
  // ─── Mi negocio ─────────────────────────────────────────
  {
    key: 'business_name',
    value: 'FotoApp',
    label: 'Nombre del negocio',
    category: 'negocio',
    description:
      'El nombre de tu estudio. Aparece en el menú lateral y en el encabezado de tus recibos. Ej: "Foto Estudio Andrés".',
  },
  {
    key: 'business_tagline',
    value: 'Gestión Fotográfica de Eventos',
    label: 'Eslogan',
    category: 'negocio',
    description:
      'Frase corta bajo el nombre para dar identidad a tus recibos. Ej: "Comuniones, bodas y retratos".',
  },
  {
    key: 'pdf_page_size',
    value: 'A4',
    label: 'Tamaño de página del recibo',
    category: 'negocio',
    description:
      'El papel de tus recibos PDF. Si imprimes en Colombia, elige Carta (Letter).',
  },
  {
    key: 'pdf_accent_color',
    value: '#22c55e',
    label: 'Color de marca en el recibo',
    category: 'negocio',
    description:
      'El color que identifica tu marca en el recibo: encabezado y montos pendientes.',
  },
  {
    key: 'export_directory',
    value: '',
    label: 'Carpeta para exportar',
    category: 'negocio',
    description:
      'Dónde se guardan los archivos exportados (Excel). Déjala vacía para elegir la carpeta cada vez.',
  },

  // ─── Mis eventos ────────────────────────────────────────
  {
    key: 'default_event_category',
    value: 'SACRAMENTAL',
    label: 'Categoría de evento por defecto',
    category: 'eventos',
    description:
      'El tipo de evento que se seleccionará automáticamente al crear uno nuevo.',
  },
  {
    key: 'default_event_subtype',
    value: 'COMUNION',
    label: 'Subtipo de evento por defecto',
    category: 'eventos',
    description:
      'El estilo de sesión pre-seleccionado al crear un evento nuevo. Debe corresponder a la categoría elegida.',
  },
  {
    key: 'default_cover_price',
    value: '50000',
    label: 'Precio por defecto',
    category: 'eventos',
    description:
      'Precio sugerido (en pesos colombianos) para eventos nuevos. Puedes cambiarlo al crear el evento.',
  },

  // ─── Cobros y entregas ──────────────────────────────────
  {
    key: 'payment_methods',
    value: 'Efectivo,Transferencia bancaria,Nequi,Daviplata,Otro',
    label: 'Métodos de pago',
    category: 'entregas',
    description: 'Las formas en que cobras. Escribe uno y presiona Enter para agregarlo.',
  },
  {
    key: 'delivery_payment_threshold',
    value: '50',
    label: 'Pago mínimo para entregar',
    category: 'entregas',
    description:
      'Cuánto debe haber pagado el cliente (en %) para recibir sus fotos. Ej: 50 = debe abonar al menos la mitad.',
  },
]

export class SettingsService {
  private repository: SettingsRepository

  constructor(repository: SettingsRepository) {
    this.repository = repository
  }

  /**
   * @function validateValue
   * @description Valida el formato de un valor según su clave.
   * Aplica reglas por tipo: umbral 0-100, precios >= 0, métodos no vacíos
   * sin duplicados, color hexadecimal, tamaño de página válido, etc.
   * @throws Error si el valor no cumple las reglas.
   */
  private validateValue(key: string, value: string): void {
    const setting = DEFAULT_SETTINGS.find((s) => s.key === key)
    if (!setting) return

    const trimmed = value.trim()

    switch (key) {
      case 'delivery_payment_threshold': {
        const num = Number(trimmed)
        if (!Number.isInteger(num) || num < 0 || num > 100) {
          throw new Error('El pago mínimo debe ser un número entero entre 0 y 100')
        }
        break
      }
      case 'default_cover_price': {
        const num = Number(trimmed)
        if (isNaN(num) || num < 0) {
          throw new Error('El precio por defecto no puede ser negativo')
        }
        break
      }
      case 'payment_methods': {
        const methods = trimmed
          .split(',')
          .map((m) => m.trim())
          .filter(Boolean)
        if (methods.length === 0) {
          throw new Error('Debes definir al menos un método de pago')
        }
        const unique = new Set(methods)
        if (unique.size !== methods.length) {
          throw new Error('Los métodos de pago no pueden repetirse')
        }
        break
      }
      case 'pdf_accent_color': {
        if (!/^#([0-9a-fA-F]{6})$/.test(trimmed)) {
          throw new Error('El color debe ser un hexadecimal válido (#RRGGBB)')
        }
        break
      }
      case 'pdf_page_size': {
        if (!['A4', 'Letter', 'Legal'].includes(trimmed)) {
          throw new Error('El tamaño de página debe ser A4, Letter o Legal')
        }
        break
      }
      case 'default_event_category':
      case 'default_event_subtype': {
        if (!trimmed) {
          throw new Error('Este valor no puede estar vacío')
        }
        break
      }
      default:
        if (trimmed.length > 500) {
          throw new Error('El valor es demasiado largo')
        }
    }
  }

  /**
   * @description Inicializa las configuraciones por defecto si no existen.
   * Además sincroniza la metadata (categoría, etiqueta y descripción) de las
   * filas existentes para reflejar cambios de organización/copy sin tocar el
   * valor personalizado del usuario.
   */
  async initializeDefaults(): Promise<void> {
    const keys = DEFAULT_SETTINGS.map((s) => s.key)
    const existing = await this.repository.findByKeys(keys)
    const missing = DEFAULT_SETTINGS.filter((s) => !(s.key in existing))
    if (missing.length > 0) {
      await this.repository.upsertMany(missing)
    }

    await Promise.all(
      DEFAULT_SETTINGS
        .filter((s) => s.key in existing)
        .map((s) =>
          this.repository.updateMetadata(s.key, {
            category: s.category,
            label: s.label,
            description: s.description,
          })
        )
    )
  }

  /**
   * @description Obtiene todas las configuraciones agrupadas por categoría.
   */
  async getAll(): Promise<Record<string, SettingRecord[]>> {
    return this.repository.findAll()
  }

  /**
   * @description Obtiene una configuración por su clave.
   */
  async get(key: string): Promise<string | null> {
    return this.repository.findByKey(key)
  }

  /**
   * @description Obtiene múltiples configuraciones por sus claves.
   */
  async getMany(keys: string[]): Promise<Record<string, string>> {
    return this.repository.findByKeys(keys)
  }

  /**
   * @description Actualiza una configuración.
   */
  async set(key: string, value: string): Promise<void> {
    this.validateValue(key, value)
    const defaultSetting = DEFAULT_SETTINGS.find((s) => s.key === key)
    if (defaultSetting) {
      await this.repository.upsert(
        key,
        value.trim(),
        defaultSetting.label,
        defaultSetting.category,
        defaultSetting.description
      )
    } else {
      await this.repository.upsert(key, value.trim(), key, 'custom')
    }
  }

  /**
   * @description Actualiza múltiples configuraciones en lote.
   * Las dormes se validan de forma transaccional (si una falla, no se guarda ninguna).
   */
  async setMany(items: Array<{ key: string; value: string }>): Promise<void> {
    for (const item of items) {
      this.validateValue(item.key, item.value)
    }

    const upserts = items.map((item) => {
      const defaultSetting = DEFAULT_SETTINGS.find((s) => s.key === item.key)
      return {
        key: item.key,
        value: item.value.trim(),
        label: defaultSetting?.label ?? item.key,
        category: defaultSetting?.category ?? 'custom',
        description: defaultSetting?.description,
      }
    })
    await this.repository.upsertMany(upserts)
  }

  /**
   * @description Restaura una categoría a sus valores por defecto.
   */
  async resetCategory(category: string): Promise<void> {
    const defaults = DEFAULT_SETTINGS.filter((s) => s.category === category)
    if (defaults.length > 0) {
      await this.repository.upsertMany(defaults)
    }
  }

  /**
   * @description Restaura todas las configuraciones a sus valores por defecto.
   * Nota: el logo del negocio (business_logo) NO se restaura, para no perder la marca del usuario.
   */
  async resetAll(): Promise<void> {
    await this.repository.upsertMany(
      DEFAULT_SETTINGS.filter((s) => s.key !== LOGO_KEY)
    )
  }

  /**
   * @description Guarda el logo del negocio.
   * Acepta tanto una data URL (`data:image/png;base64,...`) como base64 plano.
   * Valida que sea una imagen decodificable, la normaliza a PNG y la limita a
   * 512px en su dimensión mayor para mantener el tamaño del archivo contenido.
   */
  async setLogo(dataUrl: string): Promise<void> {
    const raw = dataUrl?.trim()
    if (!raw) {
      throw new Error('El logo es obligatorio')
    }

    const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s.exec(raw)
    const b64 = match ? match[2] : raw

    if (!b64 || b64.length < 20) {
      throw new Error('El archivo seleccionado no parece una imagen válida')
    }
    if (b64.length > 2_500_000) {
      throw new Error('El logo es demasiado grande (máximo ~1.8 MB)')
    }

    const decoded = Buffer.from(b64, 'base64')
    const image = nativeImage.createFromBuffer(decoded)
    if (image.isEmpty()) {
      throw new Error('El archivo seleccionado no es una imagen válida')
    }

    let final = image
    const { width, height } = image.getSize()
    const maxDim = Math.max(width, height)
    if (maxDim > 512) {
      const scale = 512 / maxDim
      final = image.resize({
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
        quality: 'good',
      })
    }

    const pngBase64 = final.toPNG().toString('base64')
    await this.repository.upsert(
      LOGO_KEY,
      pngBase64,
      'Logo del negocio',
      'negocio',
      'La imagen que identifica tu estudio. Aparece en el menú lateral y en los recibos.'
    )
  }

  /**
   * @description Devuelve el logo guardado como data URL listo para el renderer.
   */
  async getLogo(): Promise<{ dataUrl: string | null }> {
    const value = await this.repository.findByKey(LOGO_KEY)
    if (!value || value.length < 20) {
      return { dataUrl: null }
    }
    return { dataUrl: `data:image/png;base64,${value}` }
  }

  /**
   * @description Elimina el logo del negocio.
   */
  async removeLogo(): Promise<void> {
    await this.repository.delete(LOGO_KEY)
  }
}
