// src/main/repositories/participant.repository.ts
// Repository Pattern para la entidad Participant.
// Maneja CRUD individual, acciones en lote (HU-D6) e importación masiva (HU-D5).

import { PrismaClient, Prisma, ParticipantStatus, PaymentStatus } from '@prisma/client'
import type { CustomerSummary } from '../../../shared/types/ipc'
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
 * @class ParticipantRepository
 * @description Capa de acceso a datos para participantes.
 *
 * Responsabilidades:
 * - CRUD individual de participantes
 * - Operaciones bulk (actualización masiva de estados/pagos)
 * - Importación masiva desde CSV/Excel
 * - Búsqueda por código de barras (para rastreo de entregas)
 *
 * @security Las operaciones bulk usan transacciones de Prisma
 * para garantizar atomicidad (si falla una, fallan todas).
 */
export class ParticipantRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * @method findByEvent
   * @description Lista participantes de un evento con filtros y paginación.
   * Soporta búsqueda por nombre/teléfono y filtrado por estado.
   *
   * @param {ListParticipantsInput} params - Parámetros de filtrado
   * @returns Participantes paginados
   */
  async findByEvent(params: ListParticipantsInput) {
    const {
      eventId,
      page,
      pageSize,
      search,
      status,
      paymentStatus,
      sortBy,
      sortOrder,
    } = params
    const skip = (page - 1) * pageSize

    const where: Prisma.ParticipantWhereInput = {
      eventId,
      ...(status && { status: status as ParticipantStatus }),
      ...(paymentStatus && { paymentStatus: paymentStatus as PaymentStatus }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { cedula: { contains: search } },
          { phone: { contains: search } },
          { email: { contains: search } },
          { barcode: { contains: search } },
        ],
      }),
    }

    const [items, total] = await Promise.all([
      this.prisma.participant.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
        include: { event: true },
      }),
      this.prisma.participant.count({ where }),
    ])

    return {
      items: items.map((p) => ({
        ...p,
        items: this.parseItems(p.items),
        event: p.event
          ? {
              id: p.event.id,
              name: p.event.name,
              date: p.event.date,
              location: p.event.location,
              coverPrice: p.event.coverPrice,
            }
          : null,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * @method findById
   * @description Busca un participante por ID con datos del evento padre.
   */
  async findById(id: string) {
    const p = await this.prisma.participant.findUnique({
      where: { id },
      include: { event: true },
    })
    return p ? { ...p, items: this.parseItems(p.items) } : null
  }

  /**
   * @method findByBarcode
   * @description Búsqueda por código de barras (para escáner en entregas).
   * El barcode es único globalmente en el esquema Prisma.
   */
  async findByBarcode(barcode: string) {
    const p = await this.prisma.participant.findUnique({
      where: { barcode },
      include: { event: true },
    })
    return p ? { ...p, items: this.parseItems(p.items) } : null
  }

  /**
   * @method create
   * @description Crea un participante individual.
   * Genera automáticamente un barcode único si no se proporciona.
   * Guarda el "Detalle de Compra" (`items` array) y su `totalAmount`.
   *
   * @param {CreateParticipantInput} data - Datos validados
   * @returns Participante creado
   */
  async create(data: CreateParticipantInput) {
    const barcode = this.generateBarcode()

    const { items, quantity, unitPrice } = this.normalizePurchase(
      data.items,
      data.quantity,
      data.unitPrice
    )

    return this.prisma.participant.create({
      data: {
        eventId: data.eventId,
        name: data.name,
        cedula: data.cedula ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        notes: data.notes ?? null,
        quantity,
        unitPrice,
        items,
        totalAmount: computeTotal(items),
        barcode,
      },
    })
  }

  /**
   * @method update
   * @description Actualización parcial de un participante.
   * Soporta cambio de estado, pago, entrega y el detalle de compra.
   */
  async update(input: UpdateParticipantInput) {
    const { id, items, quantity, unitPrice, ...data } = input

    const updateData: Prisma.ParticipantUpdateInput = {
      ...(data.name && { name: data.name }),
      ...(data.cedula !== undefined && { cedula: data.cedula }),
      ...(data.phone !== undefined && { phone: data.phone }),
      ...(data.email !== undefined && { email: data.email }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.status && { status: data.status as ParticipantStatus }),
      ...(data.paymentStatus && {
        paymentStatus: data.paymentStatus as PaymentStatus,
      }),
      ...(data.paidAmount !== undefined && { paidAmount: data.paidAmount }),
      ...(data.deliveredAt !== undefined && {
        deliveredAt: data.deliveredAt ? new Date(data.deliveredAt) : null,
      }),
    }

    // ─── Detalle de compra ───────────────────────────────────
    if (items !== undefined) {
      const normalized = this.normalizePurchase(items, quantity, unitPrice)
      updateData.quantity = normalized.quantity
      updateData.unitPrice = normalized.unitPrice
      updateData.items = normalized.items
      updateData.totalAmount = computeTotal(normalized.items)
    } else if (quantity !== undefined || unitPrice !== undefined) {
      // Compatibilidad: si solo cambia cantidad/precio unitario, sincroniza el primer ítem
      const existing = await this.prisma.participant.findUnique({
        where: { id },
        select: { items: true, quantity: true, unitPrice: true },
      })
      const existingItems = this.parseItems(existing?.items)
      const normalized = this.normalizePurchase(
        existingItems,
        quantity ?? existing?.quantity ?? 1,
        unitPrice !== undefined ? unitPrice : (existing?.unitPrice ?? null)
      )
      updateData.quantity = normalized.quantity
      updateData.unitPrice = normalized.unitPrice
      updateData.items = normalized.items
      updateData.totalAmount = computeTotal(normalized.items)
    }

    return this.prisma.participant.update({
      where: { id },
      data: updateData,
    })
  }

  /**
   * @method delete
   * @description Elimina un participante individual.
   */
  async delete(id: string) {
    return this.prisma.participant.delete({ where: { id } })
  }

  /**
   * @method bulkUpdateStatus
   * @description Actualiza el estado de entrega de múltiples participantes (HU-D6).
   * Ejecuta en transacción para garantizar atomicidad.
   *
   * @param {BulkUpdateStatusInput} input - IDs + nuevo estado
   * @returns Número de registros actualizados
   */
  async bulkUpdateStatus(input: BulkUpdateStatusInput) {
    const result = await this.prisma.$transaction(
      input.participantIds.map((id) =>
        this.prisma.participant.update({
          where: { id },
          data: {
            status: input.status as ParticipantStatus,
            ...(input.status === 'ENTREGADO' && {
              deliveredAt: new Date(),
            }),
          },
        })
      )
    )
    return { updated: result.length }
  }

  /**
   * @method bulkUpdatePayment
   * @description Actualiza el estado de pago de múltiples participantes.
   * Útil para registrar pagos en lote después de una reunión de entrega.
   *
   * @param {BulkUpdatePaymentInput} input - IDs + datos de pago
   * @returns Número de registros actualizados
   */
  async bulkUpdatePayment(input: BulkUpdatePaymentInput) {
    const result = await this.prisma.$transaction(
      input.participantIds.map((id) =>
        this.prisma.participant.update({
          where: { id },
          data: {
            paymentStatus: input.paymentStatus as PaymentStatus,
            ...(input.paidAmount !== undefined && {
              paidAmount: input.paidAmount,
            }),
          },
        })
      )
    )
    return { updated: result.length }
  }

  /**
   * @method bulkDelete
   * @description Elimina múltiples participantes en transacción.
   *
   * @param {BulkDeleteInput} input - IDs a eliminar
   * @returns Número de registros eliminados
   */
  async bulkDelete(input: BulkDeleteInput) {
    const result = await this.prisma.$transaction(
      input.participantIds.map((id) =>
        this.prisma.participant.delete({ where: { id } })
      )
    )
    return { deleted: result.length }
  }

  /**
   * @method importCsv
   * @description Importación masiva de participantes desde CSV/Excel (HU-D5).
   * Inserta registros dentro de una transacción.
   * Si un registro individual falla, se omite y se reporta el error,
   * pero los registros exitosos SÍ se confirman (commit parcial).
   *
   * @param {ImportCsvInput} input - Evento destino + filas parseadas
   * @returns Resumen de la importación (éxitos/errores)
   */
  async importCsv(input: ImportCsvInput) {
    let imported = 0
    const errors: string[] = []

    await this.prisma.$transaction(async (tx) => {
      for (const row of input.rows) {
        try {
          await tx.participant.create({
            data: {
              eventId: input.eventId,
              name: row.name,
              cedula: row.cedula ?? null,
              phone: row.phone ?? null,
              email: row.email ?? null,
              quantity: row.quantity,
              barcode: this.generateBarcode(),
            },
          })
          imported++
        } catch (err) {
          errors.push(
            `Error importando "${row.name}": ${(err as Error).message}`
          )
        }
      }
    })

    return { imported, errors, total: input.rows.length }
  }

  /**
   * @method generateBarcode
   * @description Genera un código de barras único para rastreo.
   * Formato: EVT-{timestamp}-{random4digits}
   *
   * @returns string con código único
   */
  private generateBarcode(): string {
    const timestamp = Date.now().toString(36).toUpperCase()
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `EVT-${timestamp}-${random}`
  }

  /**
   * @method normalizePurchase
   * @description Normaliza el "Detalle de Compra" del participante.
   * - Si existen `items`, los usa; si no, construye uno desde quantity/unitPrice.
   * - Mantiene `quantity` y `unitPrice` sincronizados con el primer ítem (compatibilidad).
   *
   * @param {Array} items - Ítems del detalle de compra (opcional)
   * @param {number} quantity - Cantidad base (índice/paquete base)
   * @param {number|null} unitPrice - Precio unitario base
   * @returns { items, quantity, unitPrice } normalizado y listo para persistir
   */
  private normalizePurchase(
    items: any[] | undefined,
    quantity?: number,
    unitPrice?: number | null
  ) {
    let normalizedItems: any[] = this.parseItems(items)

    if (normalizedItems.length === 0) {
      // Sin ítems explícitos → construir uno desde el paquete base
      normalizedItems = [
        {
          id: (unitPrice && unitPrice.toString()) || 'base-item',
          descripcion: '',
          cantidad: quantity ?? 1,
          precio_unitario: unitPrice ?? null,
          subtotal: (unitPrice ?? 0) * (quantity ?? 1),
        },
      ]
    }

    // Sincronizar quantity/unitPrice con el primer ítem
    const first = normalizedItems[0]
    const syncedQuantity = first?.cantidad ?? quantity ?? 1
    const syncedUnitPrice = first?.precio_unitario != null ? first.precio_unitario : (unitPrice ?? null)

    return {
      items: normalizedItems,
      quantity: syncedQuantity,
      unitPrice: syncedUnitPrice,
    }
  }

  /**
   * @method parseItems
   * @description Convierte el campo `items` (Json) a un array tipado.
   * Prisma devuelve Json como array en memoria, pero en SQLite puede
   * llegar como string JSON; por eso se normaliza aquí.
   */
  private parseItems(items: any): any[] {
    if (!items) return []
    if (Array.isArray(items)) return items
    if (typeof items === 'string') {
      try {
        const parsed = JSON.parse(items)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    return []
  }

  /**
   * @method listCustomers
   * @description Vista agregada de clientes únicos, agrupados por cédula.
   * Un "cliente" es una persona (cédula) que puede haber trabajado en
   * varios eventos. Para cada cédula devuelve:
   * - datos representativos (nombre/teléfono/email del registro más reciente)
   * - `timesWorked`: nº de eventos distintos en los que ha participado
   * - `totalPaid`: suma de lo pagado en todos sus registros
   * - `rating`: puntuación del cliente (única por cédula)
   *
   * @returns Array de clientes agregados, ordenado por nombre
   */
  async listCustomers(): Promise<CustomerSummary[]> {
    const rows = await this.prisma.participant.findMany({
      where: {
        cedula: { not: null },
        status: { not: 'CANCELADO' },
      },
      select: {
        cedula: true,
        name: true,
        phone: true,
        email: true,
        rating: true,
        paidAmount: true,
        eventId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    type CustomerAgg = CustomerSummary & { eventIds: Set<string> }
    const byCedula = new Map<string, CustomerAgg>()

    rows.forEach((row) => {
      const cedula = row.cedula as string
      let agg = byCedula.get(cedula)
      if (!agg) {
        agg = {
          cedula,
          name: row.name,
          phone: row.phone ?? null,
          email: row.email ?? null,
          rating: row.rating ?? null,
          timesWorked: 0,
          totalPaid: 0,
          lastEventDate: null,
          eventIds: new Set<string>(),
        }
        byCedula.set(cedula, agg)
      }
      // El último registro (por createdAt asc) es el más reciente → representa al cliente
      agg.name = row.name
      agg.phone = row.phone ?? agg.phone
      agg.email = row.email ?? agg.email
      if (row.rating != null) agg.rating = row.rating

      const evtKey = row.eventId
      if (!agg.eventIds.has(evtKey)) {
        agg.eventIds.add(evtKey)
        agg.timesWorked = agg.eventIds.size
      }
      agg.totalPaid += Number(row.paidAmount ?? 0) || 0
      if (row.createdAt) {
        if (!agg.lastEventDate || row.createdAt > agg.lastEventDate) {
          agg.lastEventDate = row.createdAt
        }
      }
    })

    return [...byCedula.values()]
      .map(({ eventIds: _eventIds, ...customer }) => customer)
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  /**
   * @method setCustomerRating
   * @description Asigna la puntuación de un cliente (única por cédula).
   * Como el rating pertenece al cliente (cédula) y no a un participante
   * individual, se aplica a TODOS los participantes con esa cédula para
   * mantener el listado agregado siempre consistente.
   *
   * @param {string} cedula - Cédula del cliente
   * @param {number | null} rating - 1=Cuidado, 2=Regular, 3=Buena (null limpia)
   * @returns Número de participantes actualizados
   */
  async setCustomerRating(cedula: string, rating: number | null): Promise<number> {
    const res = await this.prisma.participant.updateMany({
      where: { cedula },
      data: { rating },
    })
    return res.count
  }
}

/**
 * @function computeTotal
 * @description Calcula la suma de subtotales del detalle de compra.
 * Cada ítem aporta `subtotal = cantidad * precio_unitario`.
 */
function computeTotal(items: any[] = []): number {
  return items.reduce(
    (sum, item) =>
      sum + (Number(item?.subtotal ?? 0) || 0),
    0
  )
}
