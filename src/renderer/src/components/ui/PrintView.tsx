// src/renderer/src/components/ui/PrintView.tsx
// Vista de impresión para listas de participantes.
// Se renderiza oculto y se muestra solo al imprimir.

import React from 'react'
import { formatCOP } from '../../lib/format'

interface PrintViewProps {
  eventName: string
  eventDate: string
  eventLocation: string | null
  participants: {
    name: string
    phone: string | null
    email: string | null
    quantity: number
    unitPrice: number | null
    coverPrice: number
    status: string
    paymentStatus: string
    paidAmount: number
    barcode: string | null
  }[]
}

export function PrintView({ eventName, eventDate, eventLocation, participants }: PrintViewProps) {
  const totalRevenue = participants.reduce((sum, p) => {
    const price = p.unitPrice ?? p.coverPrice
    return sum + price * p.quantity
  }, 0)

  const totalCollected = participants.reduce((sum, p) => sum + p.paidAmount, 0)

  return (
    <div className="print-view hidden print:block">
      <style>{`
        @media print {
          .print-view { display: block !important; }
          body * { visibility: hidden; }
          .print-view, .print-view * { visibility: visible; }
          .print-view { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '15px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>FotoApp</h1>
        <p style={{ fontSize: '12px', color: '#666', margin: '2px 0 0' }}>Gestión Fotográfica de Eventos</p>
      </div>

      {/* Info del evento */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 8px' }}>{eventName}</h2>
        <p style={{ fontSize: '12px', color: '#555', margin: '2px 0' }}>
          Fecha: {new Date(eventDate).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
        {eventLocation && (
          <p style={{ fontSize: '12px', color: '#555', margin: '2px 0' }}>Lugar: {eventLocation}</p>
        )}
        <p style={{ fontSize: '12px', color: '#555', margin: '2px 0' }}>
          Total participantes: {participants.length}
        </p>
      </div>

      {/* Tabla */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #d1d5db' }}>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold' }}>#</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold' }}>Nombre</th>
            <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 'bold' }}>Teléfono</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold' }}>Cant.</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>Precio</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>Total</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold' }}>Estado</th>
            <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 'bold' }}>Pagado</th>
            <th style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 'bold' }}>Código</th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p, i) => {
            const price = p.unitPrice ?? p.coverPrice
            const total = price * p.quantity
            return (
              <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '5px 8px' }}>{i + 1}</td>
                <td style={{ padding: '5px 8px', fontWeight: '500' }}>{p.name}</td>
                <td style={{ padding: '5px 8px' }}>{p.phone || '—'}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center' }}>{p.quantity}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCOP(price)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCOP(total)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                  {p.status === 'ENTREGADO' ? '✓' : p.status === 'PENDIENTE' ? 'P' : p.status === 'EN_PROCESO' ? 'E' : 'X'}
                </td>
                <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatCOP(p.paidAmount)}</td>
                <td style={{ padding: '5px 8px', textAlign: 'center', fontSize: '8px' }}>{p.barcode || '—'}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #333', fontWeight: 'bold' }}>
            <td colSpan={5} style={{ padding: '8px', textAlign: 'right' }}>TOTALES:</td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{formatCOP(totalRevenue)}</td>
            <td></td>
            <td style={{ padding: '8px', textAlign: 'right' }}>{formatCOP(totalCollected)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {/* Footer */}
      <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '10px', fontSize: '10px', color: '#999', textAlign: 'center' }}>
        <p>Impreso el {new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
        <p>FotoApp — Gestión Fotográfica</p>
      </div>
    </div>
  )
}
