// src/main/services/payment.service.ts
// Service para operaciones de pagos individuales (ledger).
// Orquesta la lógica de negocio: validación de montos, cálculo de estados.

import { PaymentRepository, CreatePaymentInput } from '../repositories/payment.repository'

export class PaymentService {
  constructor(private paymentRepo: PaymentRepository) {}

  /**
   * @method create
   * @description Registra un nuevo pago para un participante.
   * Valida que el monto sea positivo y que no exceda el total adeudado.
   */
  async create(input: CreatePaymentInput) {
    if (input.amount <= 0) {
      throw new Error('El monto del pago debe ser mayor a 0')
    }

    return this.paymentRepo.create(input)
  }

  /**
   * @method findByParticipant
   * @description Obtiene el historial de pagos de un participante.
   */
  async findByParticipant(participantId: string) {
    return this.paymentRepo.findByParticipant(participantId)
  }

  /**
   * @method delete
   * @description Elimina un pago registrado y recalcula el saldo.
   */
  async delete(paymentId: string) {
    return this.paymentRepo.delete(paymentId)
  }

  /**
   * @method correct
   * @description Deshace el pago más reciente del participante (registrado por
   * error, p.ej. un 'PAGO_TOTAL') y recalcula el saldo y el estado de pago.
   */
  async correct(participantId: string) {
    return this.paymentRepo.correct(participantId)
  }
}
