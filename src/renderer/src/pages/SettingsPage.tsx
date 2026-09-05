// src/renderer/src/pages/SettingsPage.tsx
// Página de configuración de la aplicación.
// Organizada por intención del usuario: "Mi negocio", "Mis eventos" y
// "Cobros y entregas". Cada campo indica a dónde afecta en lenguaje claro.
// UX: editor de tags, color picker, selector de carpeta, selects de
// categoría/subtipo autocorregidos, confirmaciones y guardia de cambios.

import React, { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useUIStore } from '../stores/ui.store'
import { useSettings, useUpdateSettings, useResetSettings } from '../hooks/useSettings'
import { useToast } from '../hooks/useToast'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { UsersSection } from '../components/settings/UsersSection'
import {
  CategorySubtypeMap,
  EventCategoryLabels,
  EventSubtypeLabels,
} from '../../../../shared/schemas/event.schema'

// Orden en que se muestran las secciones (las desconocidas van al final)
const SECTION_ORDER = ['negocio', 'eventos', 'entregas']

const CATEGORY_LABELS: Record<string, string> = {
  negocio: 'Mi negocio',
  eventos: 'Mis eventos',
  entregas: 'Cobros y entregas',
  // Categorías legadas (por si quedan filas sin migrar)
  general: 'Información general',
  precios: 'Precios',
  pagos: 'Métodos de pago',
  documentos: 'Documentos / PDF',
  exportacion: 'Exportación',
  custom: 'Personalizado',
}

const CATEGORY_OPTIONS = Object.keys(CategorySubtypeMap)

const PAGE_SIZE_OPTIONS = ['A4', 'Letter', 'Legal']

export function SettingsPage() {
  const theme = useUIStore((s) => s.theme)
  const setUnsavedSettings = useUIStore((s) => s.setUnsavedSettings)
  const { data: settings, isLoading } = useSettings()
  const updateMutation = useUpdateSettings()
  const resetMutation = useResetSettings()
  const { success: toastSuccess, error: toastError } = useToast()

  const [localValues, setLocalValues] = useState<Record<string, string>>({})
  const [showResetConfirm, setShowResetConfirm] = useState<string | null>(null)

  const hasChanges = Object.keys(localValues).length > 0

  // Notifica al App si hay cambios sin guardar (guardia de navegación)
  useEffect(() => {
    setUnsavedSettings(hasChanges)
  }, [hasChanges, setUnsavedSettings])

  const getValue = (key: string, defaultValue: string): string => {
    if (key in localValues) return localValues[key]
    if (settings) {
      for (const categoryItems of Object.values(settings)) {
        const found = categoryItems.find((s) => s.key === key)
        if (found) return found.value
      }
    }
    return defaultValue
  }

  const setLocalValue = (key: string, value: string) => {
    setLocalValues((prev) => {
      const next = { ...prev, [key]: value }
      // Si el valor vuelve a coincidir con el guardado, no marcarlo como cambio
      if (next[key] === getSavedValue(key)) {
        delete next[key]
      }
      return next
    })
  }

  const getSavedValue = (key: string): string => {
    if (settings) {
      for (const categoryItems of Object.values(settings)) {
        const found = categoryItems.find((s) => s.key === key)
        if (found) return found.value
      }
    }
    return ''
  }

  // ─── Guardia de cambios sin guardar al navegar ────────────────
  // El diálogo se muestra en App (SettingsPage se desmonta al salir).

  // Advertencia nativa del navegador al intentar cerrar la ventana
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasChanges])

  const handleSave = async () => {
    if (!hasChanges) return

    const items = Object.entries(localValues).map(([key, value]) => ({ key, value }))
    try {
      await updateMutation.mutateAsync(items)
      setLocalValues({})
      toastSuccess('Configuración guardada', 'Tus valores ya están aplicados')
    } catch (err) {
      handleSaveError(err)
    }
  }

  const handleSaveError = (err: unknown) => {
    const e = err as Error
    toastError('No se pudieron guardar los cambios', e.message || 'Revisa los valores ingresados')
  }

  const categoryKeysFor = (category: string): string[] => {
    if (!settings) return []
    return (settings[category] || []).map((s) => s.key)
  }

  const handleReset = async (category: string) => {
    try {
      await resetMutation.mutateAsync(category)
      const keysToClear =
        category === 'all'
          ? Object.keys(localValues)
          : categoryKeysFor(category)
      setLocalValues((prev) => {
        const next = { ...prev }
        for (const key of keysToClear) delete next[key]
        return next
      })
      setShowResetConfirm(null)
    } catch (err) {
      toastError('Error al restaurar', (err as Error).message || 'No se pudo restaurar')
      setShowResetConfirm(null)
    }
  }

  const handlePickDirectory = async (key: string) => {
    try {
      const response = await window.api.dialog.pickDirectory()
      if (response.success && response.data) {
        setLocalValue(key, response.data)
      }
    } catch (err) {
      toastError('Error al elegir carpeta', (err as Error).message)
    }
  }

  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm transition-colors ${
    theme === 'dark'
      ? 'border-gray-700 bg-gray-800 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none'
      : 'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-emerald-500 focus:outline-none'
  }`

  const labelClass = `block text-sm font-medium mb-1 ${
    theme === 'dark' ? 'text-gray-300' : 'text-gray-700'
  }`

  const descClass = `text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`

  const renderField = (key: string, value: string) => {
    const base = { value }

    // Categoría de evento → select; al cambiar, corrige el subtipo si no encaja
    if (key === 'default_event_category') {
      return (
        <select
          value={value}
          onChange={(e) => {
            const category = e.target.value
            setLocalValue(key, category)
            const currentSubtype = getValue('default_event_subtype', 'COMUNION')
            const options = CategorySubtypeMap[category] || []
            if (!options.includes(currentSubtype)) {
              setLocalValue('default_event_subtype', options[0] || '')
            }
          }}
          className={inputClass}
        >
          {CATEGORY_OPTIONS.map((cat) => (
            <option key={cat} value={cat}>
              {EventCategoryLabels[cat] || cat}
            </option>
          ))}
        </select>
      )
    }

    // Subtipo de evento → select limitado a la categoría configurada
    if (key === 'default_event_subtype') {
      const category = getValue('default_event_category', 'SACRAMENTAL')
      const options = CategorySubtypeMap[category] || []
      return (
        <select
          value={options.includes(value) ? value : (options[0] || '')}
          onChange={(e) => setLocalValue(key, e.target.value)}
          className={inputClass}
        >
          {options.map((st) => (
            <option key={st} value={st}>
              {EventSubtypeLabels[st] || st}
            </option>
          ))}
        </select>
      )
    }

    // Métodos de pago → editor de tags
    if (key === 'payment_methods') {
      return <TagsField key={key} {...base} onValueChange={setLocalValue} inputClass={inputClass} theme={theme} />
    }

    // Color de acento → color picker
    if (key === 'pdf_accent_color') {
      return <ColorField key={key} {...base} onValueChange={setLocalValue} inputClass={inputClass} theme={theme} />
    }

    // Tamaño de página → select
    if (key === 'pdf_page_size') {
      return <SelectField key={key} {...base} onValueChange={setLocalValue} options={PAGE_SIZE_OPTIONS} inputClass={inputClass} />
    }

    // Carpeta de exportación → input + botón de carpeta
    if (key === 'export_directory') {
      return <DirectoryField key={key} {...base} onValueChange={setLocalValue} inputClass={inputClass} onPick={() => handlePickDirectory(key)} theme={theme} />
    }

    // Precios / umbral → number
    if (key.includes('price') || key.includes('threshold')) {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => setLocalValue(key, e.target.value)}
          className={inputClass}
          min={key.includes('threshold') ? 0 : 0}
          max={key.includes('threshold') ? 100 : undefined}
          step={key.includes('threshold') ? 1 : 0.01}
        />
      )
    }

    // Texto genérico
    return (
      <input
        type="text"
        value={value}
        onChange={(e) => setLocalValue(key, e.target.value)}
        className={inputClass}
      />
    )
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-2xl space-y-6 px-6">
          <div className="space-y-2">
            <div className={`h-5 w-32 rounded ${theme === 'dark' ? 'bg-gray-700/40' : 'bg-gray-200'} animate-pulse`} />
            <div className={`h-3 w-52 rounded ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-200'} animate-pulse`} />
          </div>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`rounded-xl border p-5 ${theme === 'dark' ? 'border-gray-800/50 bg-gray-900/50' : 'border-gray-200 bg-white'}`}>
              <div className={`h-4 w-40 rounded ${theme === 'dark' ? 'bg-gray-700/40' : 'bg-gray-200'} animate-pulse mb-4`} />
              <div className="space-y-3">
                <div className={`h-9 rounded-lg ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-200'} animate-pulse`} />
                <div className={`h-9 rounded-lg ${theme === 'dark' ? 'bg-gray-700/30' : 'bg-gray-200'} animate-pulse`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div
        className={`flex items-center justify-between border-b px-6 py-4 ${
          theme === 'dark' ? 'border-gray-800' : 'border-gray-200'
        }`}
      >
        <div>
          <h1 className="text-xl font-bold">Configuración</h1>
          <p className={`text-sm ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
            Personaliza tu marca, tus eventos y tus cobros. Se aplica en recibos, formularios y entregas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && (
            <span className={`text-xs font-medium ${theme === 'dark' ? 'text-amber-400' : 'text-amber-600'}`}>
              Cambios sin guardar
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-8">
          {settings &&
            Object.entries(settings)
              .slice()
              .sort(([a], [b]) => {
                const ia = SECTION_ORDER.indexOf(a)
                const ib = SECTION_ORDER.indexOf(b)
                const ra = ia === -1 ? 99 : ia
                const rb = ib === -1 ? 99 : ib
                return ra === rb ? a.localeCompare(b) : ra - rb
              })
              .map(([category, items]) => (
                <section
                  key={category}
                  className={`rounded-xl border p-5 ${
                    theme === 'dark'
                      ? 'border-gray-800/50 bg-gray-900/50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold">
                      {CATEGORY_LABELS[category] || category}
                    </h2>
                    <button
                      onClick={() => setShowResetConfirm(category)}
                      className={`text-xs transition-colors ${
                        theme === 'dark'
                          ? 'text-gray-500 hover:text-emerald-400'
                          : 'text-gray-400 hover:text-emerald-600'
                      }`}
                    >
                      Restaurar valores por defecto
                    </button>
                  </div>

                  <div className="space-y-4">
                    {category === 'negocio' && (
                      <div>
                        <label className={labelClass}>Logo del negocio</label>
                        <p className={`${descClass} mb-1`}>
                          La imagen que identifica tu estudio. Aparece en el menú lateral y en la
                          cabecera de los recibos.
                        </p>
                        <LogoField value={getValue('business_logo', '')} theme={theme} />
                      </div>
                    )}
                    {items.map((item) => (
                      <div key={item.key}>
                        <label className={labelClass}>{item.label}</label>
                        {item.description && (
                          <p className={`${descClass} mb-1`}>{item.description}</p>
                        )}
                        {renderField(item.key, getValue(item.key, item.value))}
                      </div>
                    ))}
                  </div>
                </section>
              ))}

          {/* Usuarios y roles (solo admin) */}
          <UsersSection />

          {/* Estado de la base de datos */}
          <DatabaseInfoCard theme={theme} />

          {/* Pie: restauración global discreta */}
          <div className="flex justify-center pt-2 pb-8">
            <button
              onClick={() => setShowResetConfirm('all')}
              className={`text-xs underline decoration-dotted underline-offset-4 transition-colors ${
                theme === 'dark'
                  ? 'text-gray-500 hover:text-emerald-400'
                  : 'text-gray-400 hover:text-emerald-600'
              }`}
            >
              Restaurar todos los valores por defecto
            </button>
          </div>
        </div>
      </div>

      {/* Confirmación de restauración */}
      <ConfirmDialog
        isOpen={!!showResetConfirm}
        title="¿Restaurar valores?"
        message={
          showResetConfirm === 'all'
            ? 'Se restaurarán TODAS las configuraciones a los valores por defecto.'
            : `Se restaurarán las configuraciones de "${CATEGORY_LABELS[showResetConfirm || ''] || showResetConfirm}" a los valores por defecto.`
        }
        confirmLabel="Restaurar"
        variant="warning"
        onConfirm={() => handleReset(showResetConfirm || 'all')}
        onCancel={() => setShowResetConfirm(null)}
      />
    </div>
  )
}

// ─── Sub-componentes de campos ─────────────────────────────────────

/**
 * @component LogoField
 * @description Subida y vista previa del logo del negocio (PNG/JPG).
 * Guarda al instante cuando el ADMIN elige un archivo (no participa del
 * flujo "Cambios sin guardar", se aplica inmediatamente a la barra lateral
 * y a los recibos).
 */
function LogoField({ value, theme }: { value: string; theme: 'dark' | 'light' }) {
  const { success: toastSuccess, error: toastError } = useToast()
  const queryClient = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(
    value && value.length > 20 ? `data:image/png;base64,${value}` : null
  )
  const [busy, setBusy] = useState(false)

  const refreshSettings = () => {
    queryClient.invalidateQueries({ queryKey: ['settings'] })
  }

  const releaseFileInput = () => {
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      releaseFileInput()
      return
    }

    setBusy(true)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const res = await window.api.settings.setLogo(reader.result as string)
        if (res.success) {
          const logo = await window.api.settings.getLogo()
          setPreview(logo.success && logo.data?.dataUrl ? logo.data.dataUrl : null)
          refreshSettings()
          toastSuccess('Logo guardado', 'Tu marca ahora aparece en la barra lateral y en los recibos')
        } else {
          toastError('No se pudo guardar el logo', res.error || 'Revisa el formato del archivo')
        }
      } catch (err) {
        toastError('Error al guardar el logo', (err as Error).message)
      } finally {
        setBusy(false)
        releaseFileInput()
      }
    }
    reader.onerror = () => {
      setBusy(false)
      toastError('No se pudo leer el archivo', 'Intenta con otra imagen')
      releaseFileInput()
    }
    reader.readAsDataURL(file)
  }

  const handleRemove = async () => {
    setBusy(true)
    try {
      const res = await window.api.settings.removeLogo()
      if (res.success) {
        setPreview(null)
        refreshSettings()
        toastSuccess('Logo eliminado', 'Volverá a mostrarse el nombre del negocio')
      } else {
        toastError('No se pudo quitar el logo', res.error || '')
      }
    } catch (err) {
      toastError('Error', (err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border ${
            theme === 'dark' ? 'border-gray-700 bg-gray-800' : 'border-gray-300 bg-gray-100'
          }`}
        >
          {preview ? (
            <img src={preview} alt="Logo del negocio" className="max-h-full max-w-full object-contain" />
          ) : (
            <span className={`text-[10px] ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Sin logo</span>
          )}
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            theme === 'dark'
              ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
              : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}>
            {busy ? 'Guardando...' : 'Elegir imagen...'}
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={busy}
            />
          </label>
          {preview && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={busy}
              className={`text-xs transition-colors disabled:opacity-50 ${
                theme === 'dark' ? 'text-gray-500 hover:text-red-400' : 'text-gray-400 hover:text-red-600'
              }`}
            >
              Quitar logo
            </button>
          )}
        </div>
      </div>
      <p className={`text-[11px] ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
        Recomendado: PNG con fondo transparente de 512×512 px. Se redimensiona automáticamente.
      </p>
    </div>
  )
}

/**
 * @component DatabaseInfoCard
 * @description Muestra el estado de la base de datos (tamaño, conteos y
 * fecha del último respaldo) con un botón para refrescar.
 */
function DatabaseInfoCard({ theme }: { theme: 'dark' | 'light' }) {
  const [info, setInfo] = useState<{
    size: string
    eventCount: number
    participantCount: number
    lastBackupAt: string | null
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setError(null)
    try {
      const result = await window.api.database.getInfo()
      if (result.success && result.data) {
        setInfo(result.data)
      } else {
        setError(result.error || 'No se pudo leer el estado de la base de datos')
      }
    } catch {
      setError('No se pudo leer el estado de la base de datos')
    }
  }

  useEffect(() => {
    load()
  }, [])

  const cardClass =
    theme === 'dark'
      ? 'border-gray-800/50 bg-gray-900/50'
      : 'border-gray-200 bg-white'
  const muted = theme === 'dark' ? 'text-gray-500' : 'text-gray-400'

  const formatDate = (iso: string | null) => {
    if (!iso) return 'Nunca'
    try {
      return new Date(iso).toLocaleString()
    } catch {
      return iso
    }
  }

  return (
    <section className={`rounded-xl border p-5 ${cardClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Base de datos</h2>
        <button
          onClick={load}
          className={`text-xs transition-colors ${
            theme === 'dark'
              ? 'text-gray-500 hover:text-emerald-400'
              : 'text-gray-400 hover:text-emerald-600'
          }`}
        >
          Refrescar estado
        </button>
      </div>

      {error ? (
        <p className={`text-sm ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
      ) : !info ? (
        <p className={`text-sm ${muted}`}>Cargando...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className={muted}>Tamaño de la BD</p>
            <p className="font-medium">{info.size}</p>
          </div>
          <div>
            <p className={muted}>Último respaldo</p>
            <p className="font-medium">{formatDate(info.lastBackupAt)}</p>
          </div>
          <div>
            <p className={muted}>Eventos</p>
            <p className="font-medium">{info.eventCount}</p>
          </div>
          <div>
            <p className={muted}>Participantes</p>
            <p className="font-medium">{info.participantCount}</p>
          </div>
        </div>
      )}
    </section>
  )
}

interface FieldBaseProps {
  value: string
  onValueChange: (key: string, value: string) => void
  inputClass: string
}

/**
 * @component TagsField
 * @description Editor visual de tags para `payment_methods` (chips + Enter).
 */
function TagsField({
  value,
  onValueChange,
  inputClass,
  theme,
}: FieldBaseProps & { theme: 'dark' | 'light' }) {
  const [draft, setDraft] = useState('')
  const tags = Array.from(
    new Set(
      value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  )

  const addTag = () => {
    const trimmed = draft.trim()
    if (trimmed && !tags.includes(trimmed)) {
      onValueChange('payment_methods', [...tags, trimmed].join(','))
    }
    setDraft('')
  }

  const tagClass = theme === 'dark'
    ? 'bg-gray-800 text-gray-200 border-gray-700'
    : 'bg-gray-100 text-gray-800 border-gray-300'

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tagClass}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => onValueChange('payment_methods', tags.filter((t) => t !== tag).join(','))}
              className="ml-0.5 rounded-full p-0.5 text-gray-400 hover:text-red-400 transition-colors"
              title={`Eliminar ${tag}`}
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className={`text-xs ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
            Sin métodos de pago. Agrega al menos uno.
          </span>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addTag()
            }
          }}
          placeholder="Escribe y presiona Enter..."
          className={inputClass}
        />
        <button
          type="button"
          onClick={addTag}
          className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            theme === 'dark'
              ? 'text-gray-300 hover:bg-gray-700'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Agregar
        </button>
      </div>
    </div>
  )
}

/**
 * @component ColorField
 * @description Color picker con preview del valor hexadecimal.
 */
function ColorField({ value, onValueChange, inputClass, theme }: FieldBaseProps & { theme: 'dark' | 'light' }) {
  const isHex = /^#([0-9a-fA-F]{6})$/.test(value)
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={isHex ? value : '#22c55e'}
        onChange={(e) => onValueChange('pdf_accent_color', e.target.value)}
        className={`h-9 w-12 cursor-pointer rounded-lg border p-1 ${
          theme === 'dark'
            ? 'border-gray-700 bg-gray-800'
            : 'border-gray-300 bg-white'
        }`}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange('pdf_accent_color', e.target.value)}
        className={inputClass}
        placeholder="#22c55e"
      />
    </div>
  )
}

/**
 * @component SelectField
 * @description Select genérico para opciones cerradas.
 */
function SelectField({
  value,
  onValueChange,
  options,
  inputClass,
}: FieldBaseProps & { options: string[] }) {
  return (
    <select value={value} onChange={(e) => onValueChange('pdf_page_size', e.target.value)} className={inputClass}>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  )
}

/**
 * @component DirectoryField
 * @description Input de ruta con botón para abrir el selector nativo de carpeta.
 */
function DirectoryField({ value, onValueChange, inputClass, onPick, theme }: FieldBaseProps & { onPick: () => void; theme: 'dark' | 'light' }) {
  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange('export_directory', e.target.value)}
        className={inputClass}
        placeholder="Elige una carpeta o escribe la ruta"
      />
      <button
        type="button"
        onClick={onPick}
        className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
          theme === 'dark'
            ? 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
            : 'border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200'
        }`}
        title="Seleccionar carpeta"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      </button>
    </div>
  )
}