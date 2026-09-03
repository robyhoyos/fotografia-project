// src/renderer/src/components/drawers/ParticipantDrawer.tsx
// Drawer lateral para ver detalle y editar participantes.
// Reemplaza modales invasivos por un panel lateral deslizante.
//
// Diseño UI:
// - Se desliza desde la derecha (384px de ancho)
// - Overlay oscuro semitransparente
// - Transición suave de entrada/salida
// - Sección de detalle + formulario de edición

import React, { useState, useEffect } from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useThemeTokens } from '../../lib/theme'
import { useUpdateParticipant, useCreateParticipant } from '../../hooks/useParticipants'
import { useCreatePayment } from '../../hooks/usePayments'
import { useToast } from '../../hooks/useToast'
import { useRole } from '../../hooks/useRole'
import { usePaymentMethods } from '../../hooks/useSettings'
import { formatCOP } from '../../lib/format'
import { isValidColombianPhone } from '../../../../../shared/schemas/participant.schema'
import { PaymentHistory } from '../ui/PaymentHistory'
import type { ParticipantSummary, PurchaseItem } from '../../../../../shared/types/ipc'
import type { UpdateParticipantInput } from '../../../../../shared/schemas/participant.schema'

/**
 * @interface ParticipantDrawerProps
 * @description Props del drawer de participantes.
 */
interface ParticipantDrawerProps {
  eventId: string
}

/**
 * @interface CartItem
 * @description Ítem de edición del "Detalle de Compra".
 * `cantidad` y `precio_unitario` se guardan como string durante la edición
 * para evitar el bug de leading-zero en inputs numéricos controlados.
 */
interface CartItem {
  id: string
  descripcion: string
  cantidad: string
  precio_unitario: string
  subtotal: number
}

/**
 * @function makeItem
 * @description Crea un nuevo ítem del "Detalle de Compra" (estado de edición).
 */
function makeItem(descripcion = '', cantidad = 1, precio_unitario = 0): CartItem {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 8)}`,
    descripcion,
    cantidad: String(cantidad),
    precio_unitario: precio_unitario > 0 ? String(precio_unitario) : '',
    subtotal: cantidad * precio_unitario,
  }
}

/**
 * @function itemsTotal
 * @description Suma los subtotales del detalle de compra.
 */
function itemsTotal(items: CartItem[]): number {
  return items.reduce((sum, i) => sum + (i.subtotal || 0), 0)
}

/**
 * @component ParticipantDrawer
 * @description Panel lateral para gestión de participantes.
 *
 * Modos:
 * 1. detail: Muestra información completa del participante
 * 2. edit: Formulario de edición con campos validados
 *
 * Flujo:
 * ```text
 * 1. Click en fila de tabla → openDrawer('participant-detail', participant)
 * 2. Drawer se desliza desde la derecha
 * 3. Muestra datos del participante con badge de estado
 * 4. Click en "Editar" → cambia a modo edit
 * 5. Usuario modifica campos → useUpdateParticipant (Optimistic)
 * 6. Click en "Guardar" → mutación IPC + cierre del drawer
 * ```
 */
export function ParticipantDrawer({ eventId }: ParticipantDrawerProps) {
  const { activeDrawer, closeDrawer } = useUIStore()
  const t = useThemeTokens()
  const { readOnly } = useRole()
  const dark = useUIStore((s) => s.theme) === 'dark'
  const participant = activeDrawer.data as ParticipantSummary | null

  // Clases derivadas del tema para el contenido interno (antes hardcodeado a dark)
  const valCls = dark ? 'text-gray-300' : 'text-gray-700'
  const valClsSm = dark ? 'text-gray-300' : 'text-gray-600'
  const muteCls = dark ? 'text-gray-400' : 'text-gray-500'
  const inputBase =
    'mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ' +
    (dark
      ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-600'
      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400') +
    ' focus:border-emerald-500 focus:ring-emerald-500'
  const inputResize = `${inputBase} resize-none`
  const inputErrorBase =
    'mt-1 w-full rounded-lg border border-red-500/70 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:border-red-500 focus:ring-red-500 ' +
    (dark
      ? 'bg-gray-800 text-white placeholder-gray-600'
      : 'bg-white text-gray-900 placeholder-gray-400')
  const itemDivider = dark ? 'border-gray-700/50' : 'border-gray-200'
  const itemDividerSoft = dark ? 'border-gray-700/40' : 'border-gray-200'
  const prodBg = dark ? 'bg-gray-800/60' : 'bg-gray-100'
  const prodBorder = dark ? 'border-gray-600/50' : 'border-gray-300'
  const statusBtn = (active: boolean) =>
    active
      ? dark
        ? 'border-gray-700 bg-gray-800 text-gray-500 cursor-not-allowed'
        : 'border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed'
      : dark
      ? 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700 hover:text-white'
      : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900'
  const isOpen = activeDrawer.type === 'participant-detail' ||
                 activeDrawer.type === 'participant-edit' ||
                 activeDrawer.type === 'participant-create'
  const isCreateMode = activeDrawer.type === 'participant-create'
  const createData = activeDrawer.data as { eventId: string; coverPrice?: number } | null

  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    cedula: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  // ─── Detalle de Compra (patrón carrito) ─────────────────────
  const [items, setItems] = useState<CartItem[]>([])

  // ─── Pago al crear participante ─────────────────────────────
  const [paymentOption, setPaymentOption] = useState<'SIN_PAGO' | 'PAGO_TOTAL' | 'PAGO_PARCIAL'>('SIN_PAGO')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('')

  const paymentMethods = usePaymentMethods()

  const { success: toastSuccess, error: toastError } = useToast()
  const createPayment = useCreatePayment()

  const updateMutation = useUpdateParticipant(eventId)
  const createMutation = useCreateParticipant()

  // ─── Sincronizar datos al abrir ──────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setFormErrors({})
      if (isCreateMode) {
        setFormData({
          name: '',
          cedula: '',
          phone: '',
          email: '',
          notes: '',
        })
        // Inicializar la primera fila con el precio base del evento (UX)
        const basePrice = createData?.coverPrice ?? 0
        setItems([makeItem('', 1, basePrice)])
        setPaymentOption('SIN_PAGO')
        setPaymentAmount('')
        setPaymentMethod('')
        setIsEditing(true)
      } else if (participant) {
        setFormData({
          name: participant.name || '',
          cedula: participant.cedula || '',
          phone: participant.phone || '',
          email: participant.email || '',
          notes: participant.notes || '',
        })
        setItems(
          participant.items && participant.items.length > 0
            ? participant.items.map((it) => ({
                id: it.id,
                descripcion: it.descripcion,
                cantidad: String(it.cantidad ?? 1),
                precio_unitario:
                  it.precio_unitario && it.precio_unitario > 0
                    ? String(it.precio_unitario)
                    : '',
                subtotal: it.subtotal || 0,
              }))
            : [
                makeItem(
                  '',
                  participant.quantity || 1,
                  participant.unitPrice || participant.event?.coverPrice || 0
                ),
              ]
        )
        setIsEditing(activeDrawer.type === 'participant-edit')
      }
    }
  }, [participant, isOpen, activeDrawer.type, isCreateMode, createData?.coverPrice])

  // ─── Detalle de Compra: handlers ────────────────────────────

  const addItem = () => {
    setItems((prev) => [...prev, makeItem('', 1, 0)])
  }

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id))
  }

  const updateItem = (id: string, patch: Partial<CartItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it
        const next = { ...it, ...patch }
        const cantidad = parseFloat(next.cantidad) || 0
        const precio = parseThousandsInput(next.precio_unitario)
        next.subtotal = cantidad * precio
        return next
      })
    )
  }

  const total = itemsTotal(items)

  // ─── Handlers ────────────────────────────────────────────────

  const handleSave = () => {
    // Validación de campos obligatorios y formato
    const validationErrors: Record<string, string> = {}
    if (!formData.name.trim() || formData.name.trim().length < 2) {
      validationErrors.name = 'El nombre es obligatorio (mínimo 2 caracteres)'
    }
    const cedula = formData.cedula.trim()
    if (!cedula) {
      validationErrors.cedula = 'La cédula es obligatoria'
    } else if (!/^[0-9]{4,12}$/.test(cedula)) {
      validationErrors.cedula = 'La cédula debe tener entre 4 y 12 dígitos'
    }
    const phone = formData.phone.trim()
    if (!phone) {
      validationErrors.phone = 'El teléfono es obligatorio'
    } else if (!isValidColombianPhone(phone)) {
      validationErrors.phone = 'Teléfono colombiano inválido (ej. 3001234567)'
    }
    const email = formData.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.email = 'Email inválido'
    }
    setFormErrors(validationErrors)
    if (Object.keys(validationErrors).length > 0) {
      toastError('Campos obligatorios', 'Revisa los campos marcados en rojo')
      return
    }

    // Convertir el estado de edición (strings) a ítems numéricos para persistir
    const sanitizedItems: PurchaseItem[] = items
      .map((it) => {
        const cantidad = parseFloat(it.cantidad) || 0
        const precio = parseThousandsInput(it.precio_unitario)
        return {
          id: it.id,
          descripcion: it.descripcion.trim(),
          cantidad,
          precio_unitario: precio,
          subtotal: cantidad * precio,
        }
      })
      .filter((it) => it.cantidad > 0 && it.precio_unitario > 0)

    // Si no quedan ítems válidos, usar un paquete base vacío (evita guardar sin items)
    const baseItem: PurchaseItem = sanitizedItems[0] || {
      id: 'base-item',
      descripcion: 'Paquete Básico',
      cantidad: 1,
      precio_unitario: 0,
      subtotal: 0,
    }
    const allItems = sanitizedItems.length > 0 ? sanitizedItems : [baseItem]

    const base = allItems[0]

    const payload = {
      name: formData.name,
      cedula: formData.cedula.trim(),
      phone: formData.phone.trim(),
      email: formData.email?.trim() || null,
      quantity: base.cantidad || 1,
      unitPrice: base.precio_unitario > 0 ? base.precio_unitario : undefined,
      notes: formData.notes || null,
      items: allItems,
    }

    if (paymentOption === 'PAGO_PARCIAL' && (!paymentAmount || parseThousandsInput(paymentAmount) <= 0)) {
      toastError('Monto inválido', 'Ingresa un monto válido para el pago parcial')
      return
    }
    if (paymentOption === 'PAGO_PARCIAL' && parseThousandsInput(paymentAmount) > total) {
      toastError('Monto excede el total', `El pago no puede superar ${formatCOP(total)}`)
      return
    }

    if (isCreateMode) {
      createMutation.mutate(
        { eventId, ...payload },
        {
          onSuccess: (created: ParticipantSummary | undefined) => {
            // Registrar el pago directamente al crear el participante
            if (paymentOption !== 'SIN_PAGO' && created?.id) {
              const amount =
                paymentOption === 'PAGO_TOTAL'
                  ? total
                  : parseThousandsInput(paymentAmount)
              if (amount > 0) {
                createPayment.mutate(
                  {
                    participantId: created.id,
                    amount,
                    method: paymentMethod || null,
                    notes:
                      paymentOption === 'PAGO_TOTAL'
                        ? 'Pago total al crear participante'
                        : 'Abono inicial',
                  },
                  {
                    onSuccess: () => {
                      toastSuccess(
                        'Participante y pago registrado',
                        `${formatCOP(amount)} registrados para ${formData.name}`
                      )
                    },
                    onError: (err) => {
                      toastError('Participante guardado, error al registrar pago', err.message)
                    },
                  }
                )
              }
            }
            closeDrawer()
            setIsEditing(false)
          },
          onError: (err) => {
            toastError('Error al guardar participante', err.message)
          },
        }
      )
    } else {
      if (!participant) return
      updateMutation.mutate(
        { id: participant.id, ...payload },
        {
          onSuccess: () => {
            closeDrawer()
            setIsEditing(false)
          },
          onError: (err) => {
            toastError('Error al guardar participante', err.message)
          },
        }
      )
    }
  }

  const handleStatusChange = (newStatus: string) => {
    if (!participant) return
    updateMutation.mutate({
      id: participant.id,
      status: newStatus as UpdateParticipantInput['status'],
      ...(newStatus === 'ENTREGADO' && {
        deliveredAt: new Date().toISOString(),
      }),
    })
  }

  // ─── Colores de estado ──────────────────────────────────────

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return t.badgeAmber
      case 'EN_PROCESO':
        return t.badgeBlue
      case 'ENTREGADO':
        return t.badgeEmerald
      case 'CANCELADO':
        return t.badgeRed
      default:
        return t.badgeGray
    }
  }

  const getPaymentColor = (status: string) => {
    switch (status) {
      case 'PAGO_TOTAL':
        return t.badgeEmerald
      case 'PAGO_PARCIAL':
        return t.badgeOrange
      case 'SIN_PAGO':
        return t.badgeRed
      default:
        return t.badgeGray
    }
  }

  if (!isOpen) return null
  if (!isCreateMode && !participant) return null
  if (!participant) return null

  return (
    <>
      {/* ─── Overlay ───────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 backdrop-blur-sm transition-opacity ${t.overlay}`}
        onClick={closeDrawer}
      />

      {/* ─── Panel lateral ─────────────────────────────────── */}
      <div className={`fixed inset-y-0 right-0 z-50 w-[420px] border-l shadow-2xl transition-transform duration-300 ease-in-out ${t.drawerHeader} ${t.drawerBg}`}>
        <div className="flex h-full flex-col">
          {/* ─── Header ──────────────────────────────────── */}
          <div className={`flex items-center justify-between border-b px-6 py-4 ${t.border}`}>
            <div>
              <h2 className={`text-lg font-semibold ${t.textPrimary}`}>
                {isCreateMode ? 'Nuevo Participante' : isEditing ? 'Editar Participante' : 'Detalle del Participante'}
              </h2>
              <p className={`text-xs mt-0.5 ${t.textMuted}`}>
                {isCreateMode ? 'Registrar participante en este evento' : `Barcode: ${participant.barcode}`}
              </p>
            </div>
            <button
              onClick={() => {
                closeDrawer()
                setIsEditing(false)
              }}
              className={`rounded-lg p-2 transition-colors ${t.iconBtn}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ─── Contenido ───────────────────────────────── */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {!isEditing && !isCreateMode ? (
              /* ─── Modo Vista ────────────────────────────── */
              <div className="space-y-6">
                {/* Nombre */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Nombre
                  </label>
                  <p className={`mt-1 text-lg font-medium ${t.textPrimary}`}>
                    {participant.name}
                  </p>
                  {participant.cedula && (
                    <p className="mt-0.5 text-xs text-gray-500">
                      CC {participant.cedula}
                    </p>
                  )}
                </div>

                {/* Contacto */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Teléfono
                    </label>
                    <p className={`mt-1 text-sm ${valCls}`}>
                      {participant.phone || '—'}
                    </p>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email
                    </label>
                    <p className={`mt-1 text-sm ${valCls}`}>
                      {participant.email || '—'}
                    </p>
                  </div>
                </div>

                {/* Estados */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Estado de Entrega
                    </label>
                    <div className="mt-2">
                      <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(participant.status)}`}>
                        {participant.status?.replace(/_/g, ' ') || ''}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Estado de Pago
                    </label>
                    <div className="mt-2">
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${getPaymentColor(participant.paymentStatus)}`}>
                        {participant.paymentStatus?.replace(/_/g, ' ') || ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalles financieros */}
                <div className={`rounded-lg border p-4 ${t.border} ${t.surfaceAlt}`}>
                  <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
                    Detalle de Compra
                  </h3>
                  {(() => {
                    const viewItems =
                      participant.items && participant.items.length > 0
                        ? participant.items
                        : [
                            {
                              id: 'base',
                              descripcion: '',
                              cantidad: participant.quantity,
                              precio_unitario: participant.unitPrice ?? participant.event?.coverPrice ?? 0,
                              subtotal: (participant.unitPrice ?? participant.event?.coverPrice ?? 0) * participant.quantity,
                            },
                          ]
                    const viewTotal = viewItems.reduce(
                      (sum, it) => sum + (it.subtotal || 0), 0
                    )
                    return (
                      <>
                        <div className="space-y-2">
                          {viewItems.map((it, idx) => (
                            <div key={it.id || idx} className="text-sm">
                              <div className="flex justify-between">
                                <span className={valCls}>
                                  {it.descripcion?.trim() || `Paquete ${idx + 1}`}
                                  <span className={`${valClsSm} ml-1`}>
                                    ×{it.cantidad}
                                  </span>
                                </span>
                                <span className={t.textPrimary}>
                                  {formatCOP(it.subtotal || 0)}
                                </span>
                              </div>
                              {it.precio_unitario > 0 && (
                                <p className={`text-xs ${valClsSm}`}>
                                  {formatCOP(it.precio_unitario)} c/u
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className={`flex justify-between text-sm border-t ${itemDivider} pt-2 mt-2`}>
                          <span className={`${muteCls} font-medium`}>Total a Pagar</span>
                          <span className={`${t.textPrimary} font-semibold`}>
                            {formatCOP(viewTotal)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className={muteCls}>Pagado</span>
                          <span className={`${t.okText} font-medium`}>
                            {formatCOP(participant.paidAmount)}
                          </span>
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Notas */}
                {participant.notes && (
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Notas
                    </label>
                    <p className={`mt-1 text-sm ${valCls} whitespace-pre-wrap`}>
                      {participant.notes}
                    </p>
                  </div>
                )}

                {/* Fecha de entrega */}
                {participant.deliveredAt && (
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Entregado el
                    </label>
                    <p className={`mt-1 text-sm ${valCls}`}>
                      {new Date(participant.deliveredAt).toLocaleDateString('es-ES', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                )}

                {/* Acciones rápidas de estado */}
                {!readOnly && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Cambiar Estado
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {['PENDIENTE', 'EN_PROCESO', 'ENTREGADO', 'CANCELADO'].map(
                        (status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(status)}
                            disabled={participant.status === status}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${statusBtn(participant.status === status)}`}
                          >
                            {status.replace(/_/g, ' ')}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}

                {/* Historial de pagos */}
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Pagos
                  </label>
                  <div className="mt-2">
                    <PaymentHistory
                      participantId={participant.id}
                      participantName={participant.name}
                      participantCedula={participant.cedula ?? null}
                      participantPhone={participant.phone ?? null}
                      participantEmail={participant.email ?? null}
                      quantity={participant.items?.[0]?.cantidad ?? participant.quantity}
                      unitPrice={participant.items?.[0]?.precio_unitario ?? participant.unitPrice ?? null}
                      coverPrice={participant.event?.coverPrice ?? 0}
                      eventName={participant.event?.name ?? ''}
                      eventDate={participant.event?.date ?? ''}
                      eventLocation={participant.event?.location ?? null}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* ─── Modo Edición ──────────────────────────── */
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Nombre *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value })
                      if (formErrors.name) {
                        setFormErrors((prev) => ({ ...prev, name: '' }))
                      }
                    }}
                    className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                      dark
                        ? 'bg-gray-800 text-white placeholder-gray-600'
                        : 'bg-white text-gray-900 placeholder-gray-400'
                    } ${
                      formErrors.name
                        ? 'border-red-500/70 focus:border-red-500 focus:ring-red-500'
                        : dark
                        ? 'border-gray-700 focus:border-emerald-500 focus:ring-emerald-500'
                        : 'border-gray-300 focus:border-emerald-500 focus:ring-emerald-500'
                    }`}
                  />
                  {formErrors.name && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Cédula *
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formData.cedula}
                    onChange={(e) => {
                      setFormData({
                        ...formData,
                        cedula: e.target.value.replace(/[^0-9]/g, ''),
                      })
                      if (formErrors.cedula) {
                        setFormErrors((prev) => ({ ...prev, cedula: '' }))
                      }
                    }}
                    placeholder="Número de documento"
                    className={formErrors.cedula ? inputErrorBase : inputBase}
                  />
                  {formErrors.cedula && (
                    <p className="mt-1 text-xs text-red-400">{formErrors.cedula}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value })
                        if (formErrors.phone) {
                          setFormErrors((prev) => ({ ...prev, phone: '' }))
                        }
                      }}
                      placeholder="300 123 4567"
                      className={formErrors.phone ? inputErrorBase : inputBase}
                    />
                    {formErrors.phone && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.phone}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Email
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value })
                        if (formErrors.email) {
                          setFormErrors((prev) => ({ ...prev, email: '' }))
                        }
                      }}
                      className={formErrors.email ? inputErrorBase : inputBase}
                    />
                    {formErrors.email && (
                      <p className="mt-1 text-xs text-red-400">{formErrors.email}</p>
                    )}
                  </div>
                </div>

                {/* ─── Detalle de Compra (patrón carrito) ─────── */}
                <div className={`rounded-lg border p-4 ${t.border} ${t.surfaceAlt}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      Detalle de Compra
                    </span>
                    <button
                      type="button"
                      onClick={addItem}
                      className={`inline-flex items-center gap-1 rounded-lg border border-amber-500/50 bg-transparent px-3 py-1.5 text-xs font-medium ${t.accent} hover:bg-amber-500/10 transition-colors`}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Agregar Ítem / Extra
                    </button>
                  </div>

                  {items.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      Sin ítems. Agrega el paquete o extras.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {items.map((item, idx) => (
                        <div
                          key={item.id}
                          className={`rounded-lg border p-3 ${t.border} ${t.cardBg}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                              Ítem {idx + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              title="Eliminar ítem"
                              className={`rounded p-1 ${muteCls} ${
                                dark
                                  ? 'hover:bg-red-500/10 hover:text-red-400'
                                  : 'hover:bg-red-100 hover:text-red-600'
                              } transition-colors`}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>

                          <div>
                            <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                              Descripción
                            </label>
                            <input
                              type="text"
                              value={item.descripcion}
                              onChange={(e) =>
                                updateItem(item.id, { descripcion: e.target.value })
                              }
                              placeholder={idx === 0 ? 'Paquete Básico' : 'Ej: Mug, Foto Extra'}
                              className={inputBase}
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-2">
                            <div>
                              <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                                Cantidad
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={item.cantidad}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    cantidad: e.target.value,
                                  })
                                }
                                className={inputBase}
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                                Precio Unitario (COP)
                              </label>
                              <input
                                type="text"
                                inputMode="numeric"
                                min="0"
                                value={item.precio_unitario}
                                onChange={(e) =>
                                  updateItem(item.id, {
                                    precio_unitario: formatThousandsInput(e.target.value),
                                  })
                                }
                                placeholder="0"
                                className={inputBase}
                              />
                            </div>
                          </div>

                          <div className={`mt-2 flex items-center justify-between border-t ${itemDividerSoft} pt-2`}>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500">
                              Subtotal
                            </span>
                            <span className={`text-sm font-medium ${t.accent}`}>
                              {formatCOP(item.subtotal || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ─── TOTAL A PAGAR ─────────────────────── */}
                  <div className={`mt-3 flex items-center justify-between rounded-lg border ${prodBorder} ${prodBg} px-4 py-3`}>
                    <span className={`text-sm font-semibold ${t.textPrimary}`}>
                      TOTAL A PAGAR
                    </span>
                    <span className={`text-lg font-bold ${t.accent}`}>
                      {formatCOP(total)}
                    </span>
                  </div>
                </div>

                {/* ─── Pago al crear participante ────────────── */}
                {isCreateMode && (
                  <div className={`rounded-lg border p-4 ${t.border} ${t.surfaceAlt}`}>
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                      ¿Registrar pago?
                    </span>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {(
                        [
                          { value: 'SIN_PAGO', label: 'Sin pago' },
                          { value: 'PAGO_TOTAL', label: 'Pago total' },
                          { value: 'PAGO_PARCIAL', label: 'Abono' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setPaymentOption(opt.value)}
                          className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                            paymentOption === opt.value
                              ? opt.value === 'SIN_PAGO'
                                ? `border-red-500/50 bg-red-500/10 ${t.dangerText}`
                                : opt.value === 'PAGO_TOTAL'
                                ? `border-emerald-500/50 bg-emerald-500/10 ${t.okText}`
                                : `border-amber-500/50 bg-amber-500/10 ${t.accent}`
                              : t.btnGhost
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    {paymentOption === 'PAGO_TOTAL' && (
                      <div className="mt-3 rounded-lg border border-emerald-600/30 bg-emerald-500/5 px-4 py-3">
                        <div className="flex justify-between text-sm">
                          <span className={muteCls}>Total a pagar</span>
                          <span className={`${t.okText} font-semibold`}>
                            {formatCOP(total)}
                          </span>
                        </div>
                      </div>
                    )}

                    {paymentOption === 'PAGO_PARCIAL' && (
                      <div className="mt-3">
                        <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                          Monto del abono (COP) *
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={paymentAmount}
                          onChange={(e) =>
                            setPaymentAmount(
                              formatThousandsInput(e.target.value)
                            )
                          }
                          placeholder={`Máximo ${formatCOP(total)}`}
                          className={inputBase}
                        />
                      </div>
                    )}

                    {(paymentOption === 'PAGO_TOTAL' || paymentOption === 'PAGO_PARCIAL') && (
                      <div className="mt-3">
                        <label className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
                          Método de pago
                        </label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          className={inputBase}
                        >
                          <option value="">Método de pago...</option>
                          {paymentMethods.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium uppercase tracking-wider text-gray-500">
                    Notas
                  </label>
                  <textarea
                    rows={3}
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    className={inputResize}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ─── Footer ───────────────────────────────────── */}
          <div className={`border-t px-6 py-4 ${t.border}`}>
            {isEditing || isCreateMode ? (
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${t.btnGhost}`}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={updateMutation.isPending || createMutation.isPending}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  {(updateMutation.isPending || createMutation.isPending) ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            ) : readOnly ? (
              <button
                onClick={closeDrawer}
                className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${t.btnGhost}`}
              >
                Cerrar
              </button>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                Editar Participante
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * @function formatThousandsInput
 * @description Formatea un string de monto con separador de miles (COP)
 * mientras se escribe. Elimina caracteres no numéricos y agrupa en miles
 * con punto (ej. 1500 → 1.500, 1234567 → 1.234.567).
 */
function formatThousandsInput(value: string): string {
  const digits = value.replace(/[^0-9]/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * @function parseThousandsInput
 * @description Convierte un string formateado con puntos de miles a número.
 * Ej. "1.500" → 1500.
 */
function parseThousandsInput(value: string): number {
  const digits = value.replace(/\./g, '')
  return parseFloat(digits) || 0
}
