// src/main/repositories/payment.repository.ts
// Repository para operaciones de pagos individuales (ledger).
// Cada transacción de pago se registra aquí como un registro independiente.

import { PrismaClient, PaymentStatus } from '@prisma/client'

export interface CreatePaymentInput {
  participantId: string
  amount: number
  method?: string | null
  notes?: string | null
}

export class PaymentRepository {
  constructor(private prisma: PrismaClient) {}
  /**
   * @method create
   * @description Registra un nuevo pago individual.
   * También actualiza el paidAmount y paymentStatus del participante.
   */
  async create(input: CreatePaymentInput) {
    const participant = await this.prisma.participant.findUnique({
      where: { id: input.participantId },
      select: {
        id: true,
        paidAmount: true,
        unitPrice: true,
        quantity: true,
        totalAmount: true,
        items: true,
        event: { select: { coverPrice: true } },
      },
    })

    if (!participant) {
      throw new Error('Participante no encontrado')
    }

    const totalCost = getParticipantTotalCost(participant)
    const newPaidAmount = participant.paidAmount + input.amount

    let newPaymentStatus: string = 'SIN_PAGO'
    if (newPaidAmount >= totalCost) {
      newPaymentStatus = 'PAGO_TOTAL'
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'PAGO_PARCIAL'
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          participantId: input.participantId,
          amount: input.amount,
          method: input.method ?? null,
          notes: input.notes ?? null,
        },
      })

      await tx.participant.update({
        where: { id: input.participantId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus as PaymentStatus,
        },
      })

      return created
    })

    return payment
  }

  /**
   * @method findByParticipant
   * @description Lista todos los pagos de un participante ordenados por fecha descendente.
   */
  async findByParticipant(participantId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { participantId },
      orderBy: { createdAt: 'desc' },
    })

    const participant = await this.prisma.participant.findUnique({
      where: { id: participantId },
      select: {
        paidAmount: true,
        unitPrice: true,
        quantity: true,
        totalAmount: true,
        items: true,
        paymentStatus: true,
        event: { select: { coverPrice: true } },
      },
    })

    const totalCost = getParticipantTotalCost(participant)

    return {
      payments,
      summary: {
        totalCost,
        paidAmount: participant?.paidAmount ?? 0,
        outstanding: totalCost - (participant?.paidAmount ?? 0),
        paymentStatus: participant?.paymentStatus ?? 'SIN_PAGO',
      },
    }
  }

  /**
   * @method delete
   * @description Elimina un pago y recalcula el paidAmount del participante.
   */
  async delete(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { participantId: true, amount: true },
    })

    if (!payment) {
      throw new Error('Pago no encontrado')
    }

    const participant = await this.prisma.participant.findUnique({
      where: { id: payment.participantId },
      select: {
        paidAmount: true,
        unitPrice: true,
        quantity: true,
        totalAmount: true,
        items: true,
        event: { select: { coverPrice: true } },
      },
    })

    if (!participant) {
      throw new Error('Participante no encontrado')
    }

    const newPaidAmount = Math.max(0, participant.paidAmount - payment.amount)
    const totalCost = getParticipantTotalCost(participant)

    let newPaymentStatus: string = 'SIN_PAGO'
    if (newPaidAmount >= totalCost) {
      newPaymentStatus = 'PAGO_TOTAL'
    } else if (newPaidAmount > 0) {
      newPaymentStatus = 'PAGO_PARCIAL'
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.delete({ where: { id: paymentId } })

      await tx.participant.update({
        where: { id: payment.participantId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus as PaymentStatus,
        },
      })
    })

    return { deleted: true }
  }
}

/**
 * @function getParticipantTotalCost
 * @description Calcula el costo total a pagar de un participante.
 * Prioriza el "Detalle de Compra": usa `totalAmount` si existe,
 * de lo contrario computa desde los ítems, y cae al cálculo
 * legacy (unitPrice/quantity) por compatibilidad.
 */
function getParticipantTotalCost(participant: {
  totalAmount?: number | null
  items?: unknown
  unitPrice?: number | null
  quantity?: number
  event?: { coverPrice: number } | null
} | null): number {
  if (!participant) return 0

  // 1) totalAmount pre-calculado por el repositorio de participantes
  if (typeof participant.totalAmount === 'number' && participant.totalAmount > 0) {
    return participant.totalAmount
  }

  // 2) Suma de subtotales de los ítems del detalle de compra
  const items = participant.items
  if (Array.isArray(items)) {
    const itemsTotal = items.reduce(
      (sum, item) => sum + (Number((item as { subtotal?: unknown })?.subtotal ?? 0) || 0),
      0
    )
    if (itemsTotal > 0) return itemsTotal
  }

  // 3) Legado: precio unitario * cantidad
  return (participant.unitPrice ?? participant.event?.coverPrice ?? 0) * (participant.quantity ?? 1)
}
