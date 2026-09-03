// src/main/services/participant.service.ts
// Capa de lógica de negocio para participantes.
// Maneja CRUD, acciones en lote e importación masiva con validación de reglas.

import { ParticipantRepository } from '../repositories/participant.repository'
import { EventRepository } from '../repositories/event.repository'
import { SettingsRepository } from '../repositories/settings.repository'
import { formatCOP } from '../../../shared/utils/format'
import type {
  CreateParticipantInput,
  UpdateParticipantInput,
  ListParticipantsInput,
  BulkUpdateStatusInput,
  BulkUpdatePaymentInput,
  BulkDeleteInput,
  ImportCsvInput,
} from '../../../shared/schemas/participant.schema'

/**
 * @class ParticipantService
 * @description Servicio de negocio para participantes.
 *
 * Reglas de negocio implementadas:
 * - Un participante no puede ser marcado como ENTREGADO sin haber pagado al menos el umbral configurado (delivery_payment_threshold)
 * - La importación masiva valida duplicados por nombre dentro del mismo evento
 * - Las acciones bulk están limitadas a 500 registros por operación
 * - Un participante CANCELADO no puede cambiar su estado a EN_PROCESO
 */
export class ParticipantService {
  constructor(
    private participantRepo: ParticipantRepository,
    private eventRepo: EventRepository,
    private settingsRepo: SettingsRepository
  ) {}

  /**
   * @method getDeliveryThreshold
   * @description Lee la configuración `delivery_payment_threshold` (porcentaje)
   * y la convierte a fracción. Fallback: 0.5 si no existe o es inválida.
   */
  private async getDeliveryThreshold(): Promise<number> {
    const values = await this.settingsRepo.findByKeys(['delivery_payment_threshold'])
    const raw = values['delivery_payment_threshold']
    const parsed = Number(raw)
    if (!raw || isNaN(parsed)) return 0.5
    return Math.min(Math.max(parsed, 0), 100) / 100
  }

  /**
   * @method getByEvent
   * @description Lista participantes de un evento con filtros.
   *
   * @param {ListParticipantsInput} params - Parámetros de filtrado
   * @returns Participantes paginados
   */
  async getByEvent(params: ListParticipantsInput) {
    return this.participantRepo.findByEvent(params)
  }

  /**
   * @method getById
   * @description Obtiene un participante con datos del evento padre.
   */
  async getById(id: string) {
    return this.participantRepo.findById(id)
  }

  /**
   * @method getByBarcode
   * @description Búsqueda por código de barras (escáner de entrega).
   *
   * @param {string} barcode - Código escaneado
   * @returns Participante encontrado o null
   */
  async getByBarcode(barcode: string) {
    return this.participantRepo.findByBarcode(barcode)
  }

  /**
   * @method create
   * @description Crea un participante individual.
   * Valida que el evento exista y esté activo.
   *
   * @param {CreateParticipantInput} data - Datos validados por Zod
   * @returns Participante creado
   * @throws Error si el evento no existe o está cancelado
   */
  async create(data: CreateParticipantInput) {
    const event = await this.eventRepo.findById(data.eventId)

    if (!event) {
      throw new Error('El evento no existe. Selecciona un evento válido para registrar el participante.')
    }

    if (event.status === 'CANCELADO') {
      throw new Error(
        'No se pueden agregar participantes a un evento cancelado'
      )
    }

    return this.participantRepo.create(data)
  }

  /**
   * @method update
   * @description Actualiza un participante.
   * Aplica reglas de negocio sobre cambios de estado.
   *
   * @param {UpdateParticipantInput} input - Datos a actualizar
   * @returns Participante actualizado
   * @throws Error si la transición de estado no es válida
   */
  async update(input: UpdateParticipantInput) {
    const existing = await this.participantRepo.findById(input.id)

    if (!existing) {
      throw new Error('Participante no encontrado')
    }

    // Regla: no cambiar estado de un CANCELADO a EN_PROCESO
    if (
      existing.status === 'CANCELADO' &&
      input.status === 'EN_PROCESO'
    ) {
      throw new Error(
        'No se puede reactivar un participante cancelado'
      )
    }

    // Regla: para marcar ENTREGADO, debe haber pagado al menos el umbral configurado
    if (input.status === 'ENTREGADO') {
      const totalDue = getParticipantTotalDue(existing)
      const threshold = await this.getDeliveryThreshold()
      const minRequired = totalDue * threshold

      if (existing.paidAmount < minRequired) {
        throw new Error(
          `Debe haber al menos ${formatCOP(minRequired)} pagados para marcar como entregado (${Math.round(threshold * 100)}% mínimo)`
        )
      }
    }

    return this.participantRepo.update(input)
  }

  /**
   * @method delete
   * @description Elimina un participante individual.
   */
  async delete(id: string) {
    return this.participantRepo.delete(id)
  }

  /**
   * @method bulkUpdateStatus
   * @description Cambio masivo de estado de entrega (HU-D6).
   * Aplica la regla de 50% mínimo de pago a cada participante.
   *
   * @param {BulkUpdateStatusInput} input - IDs + nuevo estado
   * @returns Resumen de la operación
   */
  async bulkUpdateStatus(input: BulkUpdateStatusInput) {
    // Validar que todos los participantes cumplan la regla de pago
    if (input.status === 'ENTREGADO') {
      const threshold = await this.getDeliveryThreshold()
      for (const id of input.participantIds) {
        const participant = await this.participantRepo.findById(id)
        if (!participant) {
          throw new Error(`Participante ${id} no encontrado`)
        }

        const totalDue = getParticipantTotalDue(participant)
        const minRequired = totalDue * threshold

        if (participant.paidAmount < minRequired) {
          throw new Error(
            `"${participant.name}" solo ha pagado ${formatCOP(participant.paidAmount)} (mínimo ${formatCOP(minRequired)})`
          )
        }
      }
    }

    return this.participantRepo.bulkUpdateStatus(input)
  }

  /**
   * @method bulkUpdatePayment
   * @description Actualización masiva de pagos para múltiples participantes.
   *
   * @param {BulkUpdatePaymentInput} input - IDs + datos de pago
   * @returns Resumen de la operación
   */
  async bulkUpdatePayment(input: BulkUpdatePaymentInput) {
    return this.participantRepo.bulkUpdatePayment(input)
  }

  /**
   * @method bulkDelete
   * @description Eliminación masiva de participantes.
   *
   * @param {BulkDeleteInput} input - IDs a eliminar
   * @returns Resumen de la operación
   */
  async bulkDelete(input: BulkDeleteInput) {
    return this.participantRepo.bulkDelete(input)
  }

  /**
   * @method importCsv
   * @description Importación masiva desde CSV/Excel (HU-D5).
   * Valida duplicados por nombre dentro del mismo evento antes de insertar.
   *
   * @param {ImportCsvInput} input - Evento destino + filas parseadas
   * @returns Resumen: importados, errores, total
   */
  async importCsv(input: ImportCsvInput) {
    // Pre-validación: buscar duplicados existentes en el evento
    const existing = await this.participantRepo.findByEvent({
      eventId: input.eventId,
      page: 1,
      pageSize: 10000, // traer todos para validar duplicados
      sortBy: 'name',
      sortOrder: 'asc',
    })

    const existingNames = new Set(
      existing.items.map((p) => p.name.toLowerCase().trim())
    )

    // Separar filas válidas de duplicados
    const validRows = input.rows.filter((row) => {
      const name = row.name.toLowerCase().trim()
      if (existingNames.has(name)) {
        return false // saltar duplicados silenciosamente
      }
      existingNames.add(name) // evitar duplicados dentro del mismo CSV
      return true
    })

    if (validRows.length === 0) {
      return {
        imported: 0,
        errors: ['Todos los registros ya existen en el evento'],
        total: input.rows.length,
      }
    }

    return this.participantRepo.importCsv({
      ...input,
      rows: validRows,
    })
  }

  /**
   * @method listCustomers
   * @description Vista agregada de clientes únicos por cédula.
   *
   * @returns {Promise<CustomerSummary[]>} Clientes ordenados por nombre
   */
  async listCustomers() {
    return this.participantRepo.listCustomers()
  }

  /**
   * @method setCustomerRating
   * @description Asigna la puntuación de un cliente (única por cédula).
   *
   * @param {string} cedula - Cédula del cliente
   * @param {number | null} rating - 1 / 2 / 3 o null para limpiar
   * @returns Nº de participantes actualizados
   */
  async setCustomerRating(cedula: string, rating: number | null) {
    return this.participantRepo.setCustomerRating(cedula, rating)
  }
}

/**
 * @function getParticipantTotalDue
 * @description Calcula el total adeudado por un participante según su
 * "Detalle de Compra". Prioriza `totalAmount`, luego la suma de ítems,
 * y cae al cálculo legado (unitPrice * quantity).
 */
function getParticipantTotalDue(participant: {
  totalAmount?: number | null
  items?: unknown
  unitPrice?: number | null
  quantity?: number
  event?: { coverPrice: number } | null
}): number {
  if (typeof participant.totalAmount === 'number' && participant.totalAmount > 0) {
    return participant.totalAmount
  }

  const items = participant.items
  if (Array.isArray(items)) {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (Number((item as { subtotal?: unknown })?.subtotal ?? 0) || 0),
      0
    )
    if (itemsTotal > 0) return itemsTotal
  }

  return (participant.unitPrice ?? participant.event?.coverPrice ?? 0) * (participant.quantity ?? 1)
}
