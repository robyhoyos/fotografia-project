// src/renderer/src/hooks/usePdf.ts
// Hook para generación de documentos PDF.

import { useMutation } from '@tanstack/react-query'

/**
 * @hook useGenerateReceipt
 * @description Genera un recibo de pago en PDF y lo guarda en disco.
 */
export function useGenerateReceipt() {
  return useMutation({
    mutationFn: async (data: {
      businessName?: string
      businessTagline?: string
      pdfPageSize?: 'A4' | 'Letter' | 'Legal'
      pdfAccentColor?: string
      businessLogoBase64?: string
      eventName: string
      eventDate: string
      eventLocation: string | null
      participantName: string
      participantCedula: string | null
      participantPhone: string | null
      participantEmail: string | null
      quantity: number
      unitPrice: number
      coverPrice: number
      totalCost: number
      paidAmount: number
      outstanding: number
      paymentStatus: string
      payments: {
        amount: number
        method: string | null
        notes: string | null
        createdAt: string
      }[]
    }) => {
      const response = await window.api.pdf.generateReceipt(data)
      if (!response.success) {
        throw new Error(response.error || 'Error al generar recibo')
      }
      return response.data
    },
  })
}
