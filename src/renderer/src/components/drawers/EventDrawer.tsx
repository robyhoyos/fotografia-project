// src/renderer/src/components/drawers/EventDrawer.tsx
// Drawer lateral para crear y editar eventos.
// Soporta dos modos: creación y edición con formulario tipado.

import React, { useState, useEffect } from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useThemeTokens } from '../../lib/theme'
import {
  useCreateEvent,
  useUpdateEvent,
} from '../../hooks/useEvents'
import { useToast } from '../../hooks/useToast'
import { useSettingValue } from '../../hooks/useSettings'
import { CategorySubtypeMap } from '../../../../../shared/schemas/event.schema'
import type { CreateEventInput, UpdateEventInput } from '../../../../../shared/schemas/event.schema'
import type { EventWithParticipants } from '../../../../../shared/types/ipc'

const SUBTYPE_LABELS: Record<string, string> = {
  BODA: 'Boda',
  COMUNION: 'Comunión',
  BAUTIZO: 'Bautizo',
  CONFIRMACION: 'Confirmación',
  RETRATO_GRUPO: 'Retrato Grupo',
  ANUARIO: 'Anuario',
  GRADUACION: 'Graduación',
  RETRATO_FAMILIAR: 'Retrato Familiar',
  RETRATO_INDIVIDUAL: 'Retrato Individual',
  BOOK_FOTOGRAFICO: 'Book Fotográfico',
  EVENTO_CORPORATIVO: 'Evento Corporativo',
}

const CATEGORY_LABELS: Record<string, string> = {
  SACRAMENTAL: 'Sacramental',
  ESCOLAR: 'Escolar',
  ESTUDIO: 'Estudio',
}

interface EventFormData {
  name: string
  category: string
  subtype: string
  date: string
  location: string
  notes: string
  coverPrice: string
}

const emptyForm: EventFormData = {
  name: '',
  category: 'SACRAMENTAL',
  subtype: 'COMUNION',
  date: '',
  location: '',
  notes: '',
  coverPrice: '',
}

export function EventDrawer() {
  const { activeDrawer, closeDrawer } = useUIStore()
  const t = useThemeTokens()
  const dark = useUIStore((s) => s.theme) === 'dark'
  const isOpen = activeDrawer.type === 'event-edit'
  const editEvent = activeDrawer.data as EventWithParticipants | null
  const isEditing = !!editEvent?.id

  const { success, error: toastError } = useToast()
  const createMutation = useCreateEvent()
  const updateMutation = useUpdateEvent()

  // Defaults configurables desde Settings
  const defaultCategory = useSettingValue('default_event_category', 'SACRAMENTAL')
  const defaultSubtype = useSettingValue('default_event_subtype', 'COMUNION')
  const defaultCoverPrice = useSettingValue('default_cover_price', '')

  const [formData, setFormData] = useState<EventFormData>(emptyForm)
  const [errors, setErrors] = useState<Partial<Record<keyof EventFormData, string>>>({})

  useEffect(() => {
    if (isOpen) {
      if (editEvent?.id) {
        const eventDate = editEvent.date ? new Date(editEvent.date) : new Date()
        setFormData({
          name: editEvent.name || '',
          category: editEvent.category || 'SACRAMENTAL',
          subtype: editEvent.subtype || 'COMUNION',
          date: eventDate.toISOString().slice(0, 16),
          location: editEvent.location || '',
          notes: editEvent.notes || '',
          coverPrice: editEvent.coverPrice?.toString() || '',
        })
      } else {
        const subtypes = CategorySubtypeMap[defaultCategory] || []
        const subtype = subtypes.includes(defaultSubtype)
          ? defaultSubtype
          : subtypes[0] || ''
        setFormData({
          name: '',
          category: defaultCategory || 'SACRAMENTAL',
          subtype,
          date: '',
          location: '',
          notes: '',
          coverPrice: defaultCoverPrice || '',
        })
      }
      setErrors({})
    }
  }, [isOpen, editEvent, defaultCategory, defaultSubtype, defaultCoverPrice])

  const availableSubtypes = CategorySubtypeMap[formData.category] || []

  useEffect(() => {
    if (!availableSubtypes.includes(formData.subtype)) {
      setFormData((prev) => ({ ...prev, subtype: availableSubtypes[0] || '' }))
    }
  }, [formData.category])

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof EventFormData, string>> = {}

    if (!formData.name.trim() || formData.name.trim().length < 3) {
      newErrors.name = 'El nombre debe tener al menos 3 caracteres'
    }
    if (!formData.date) {
      newErrors.date = 'La fecha es requerida'
    }
    if (!formData.coverPrice || parseFloat(formData.coverPrice) < 0) {
      newErrors.coverPrice = 'El precio es requerido'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = () => {
    if (!validate()) return

    if (isEditing) {
      updateMutation.mutate(
        {
          id: editEvent.id,
          name: formData.name.trim(),
          category: formData.category as CreateEventInput['category'],
          subtype: formData.subtype as CreateEventInput['subtype'],
          date: new Date(formData.date).toISOString(),
          location: formData.location.trim() || null,
          notes: formData.notes.trim() || null,
          coverPrice: parseFloat(formData.coverPrice),
        },
        {
          onSuccess: () => {
            success('Evento actualizado', `"${formData.name}" se guardó correctamente`)
            closeDrawer()
          },
          onError: (err) => {
            toastError('Error al actualizar', err.message)
          },
        }
      )
    } else {
      createMutation.mutate(
        {
          name: formData.name.trim(),
          category: formData.category as CreateEventInput['category'],
          subtype: formData.subtype as CreateEventInput['subtype'],
          date: new Date(formData.date).toISOString(),
          location: formData.location.trim() || null,
          notes: formData.notes.trim() || null,
          coverPrice: parseFloat(formData.coverPrice),
        },
        {
          onSuccess: () => {
            success('Evento creado', `"${formData.name}" se registró correctamente`)
            closeDrawer()
          },
          onError: (err) => {
            toastError('Error al crear evento', err.message)
          },
        }
      )
    }
  }

  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm ${t.input}`
  const errorInputClass = `w-full rounded-lg border border-red-500/70 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 ${
    dark ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'
  }`
  const labelClass = 'text-xs font-medium uppercase tracking-wider text-gray-500'
  const errorTextClass = 'mt-1 text-xs text-red-400'

  if (!isOpen) return null

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <>
      <div
        className="fixed inset-0 z-40 backdrop-blur-sm transition-opacity"
        onClick={closeDrawer}
      />

      <div className={`fixed inset-y-0 right-0 z-50 w-[480px] border-l shadow-2xl ${t.drawerHeader} ${t.drawerBg}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center justify-between border-b px-6 py-4 ${t.border}`}>
            <h2 className={`text-lg font-semibold ${t.textPrimary}`}>
              {isEditing ? 'Editar Evento' : 'Nuevo Evento'}
            </h2>
            <button
              onClick={closeDrawer}
              className={`rounded-lg p-2 transition-colors ${t.iconBtn}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              <div>
                <label className={labelClass}>Nombre del Evento *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ej: Primera Comunión San José"
                  className={errors.name ? errorInputClass : inputClass}
                />
                {errors.name && <p className={errorTextClass}>{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Categoría *</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className={inputClass}
                  >
                    {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Subtipo *</label>
                  <select
                    value={formData.subtype}
                    onChange={(e) =>
                      setFormData({ ...formData, subtype: e.target.value })
                    }
                    className={inputClass}
                  >
                    {availableSubtypes.map((st) => (
                      <option key={st} value={st}>
                        {SUBTYPE_LABELS[st] || st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Fecha y Hora *</label>
                <input
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className={errors.date ? errorInputClass : inputClass}
                />
                {errors.date && <p className={errorTextClass}>{errors.date}</p>}
              </div>

              <div>
                <label className={labelClass}>Lugar</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Parroquia, escuela, estudio..."
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Precio Base por Defecto (COP) *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.coverPrice}
                  onChange={(e) =>
                    setFormData({ ...formData, coverPrice: e.target.value })
                  }
                  placeholder="0.00"
                  className={errors.coverPrice ? errorInputClass : inputClass}
                />
                {errors.coverPrice && <p className={errorTextClass}>{errors.coverPrice}</p>}
              </div>

              <div>
                <label className={labelClass}>Notas</label>
                <textarea
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Observaciones adicionales..."
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
          </div>

          <div className={`border-t px-6 py-4 ${t.border}`}>
            <div className="flex gap-3">
              <button
                onClick={closeDrawer}
                disabled={isPending}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${t.btnGhost}`}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
              >
                {isPending
                  ? 'Guardando...'
                  : isEditing
                  ? 'Guardar Cambios'
                  : 'Crear Evento'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
