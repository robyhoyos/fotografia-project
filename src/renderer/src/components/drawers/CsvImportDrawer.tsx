// src/renderer/src/components/drawers/CsvImportDrawer.tsx
// Drawer para importar participantes desde archivos CSV.
// Permite subir archivo, previsualizar datos e importar.

import React, { useState, useRef, useCallback } from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useThemeTokens } from '../../lib/theme'
import { useImportCsv } from '../../hooks/useParticipants'
import { useToast } from '../../hooks/useToast'
import type { ImportCsvRow } from '../../../../../shared/schemas/participant.schema'
import { isValidColombianPhone } from '../../../../../shared/schemas/participant.schema'

interface ParsedRow {
  name: string
  cedula: string
  phone: string
  email: string
  quantity: number
  isValid: boolean
  errors: string[]
}

export function CsvImportDrawer() {
  const { activeDrawer, closeDrawer } = useUIStore()
  const theme = useUIStore((s) => s.theme)
  const t = useThemeTokens()
  const isOpen = activeDrawer.type === 'import-csv'
  const eventId = (activeDrawer.data as { eventId?: string } | null)?.eventId || ''

  const { success, error: toastError, warning } = useToast()
  const importMutation = useImportCsv(eventId)

  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
  const [fileName, setFileName] = useState('')
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = useCallback(() => {
    setParsedRows([])
    setFileName('')
    setStep('upload')
  }, [])

  const handleClose = useCallback(() => {
    resetState()
    closeDrawer()
  }, [resetState, closeDrawer])

  const parseCSV = useCallback((text: string): ParsedRow[] => {
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) return []

    const header = lines[0].toLowerCase().split(',').map((h) => h.trim().replace(/"/g, ''))
    const nameIdx = header.findIndex((h) => h.includes('nombre') || h === 'name')
    const cedulaIdx = header.findIndex(
      (h) => h === 'cédula' || h === 'cedula' || h === 'cc' || h === 'documento' || h.includes('identificacion') || h.includes('identificación')
    )
    const phoneIdx = header.findIndex((h) => h.includes('telefono') || h.includes('teléfono') || h === 'phone')
    const emailIdx = header.findIndex((h) => h.includes('email') || h.includes('correo'))
    const qtyIdx = header.findIndex((h) => h.includes('cantidad') || h === 'quantity')

    if (nameIdx === -1) return []

    return lines.slice(1).map((line) => {
      const cols = line.split(',').map((c) => c.trim().replace(/"/g, ''))
      const rowErrors: string[] = []

      const name = cols[nameIdx] || ''
      const cedula = cedulaIdx >= 0 ? cols[cedulaIdx] || '' : ''
      const phone = phoneIdx >= 0 ? cols[phoneIdx] || '' : ''
      const email = emailIdx >= 0 ? cols[emailIdx] || '' : ''
      const qty = qtyIdx >= 0 ? parseInt(cols[qtyIdx]) || 1 : 1

      if (!name || name.length < 2) rowErrors.push('Nombre requerido')
      if (cedula && !/^[0-9]{4,12}$/.test(cedula)) rowErrors.push('Cédula inválida (solo dígitos, 4-12)')
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) rowErrors.push('Email inválido')
      if (phone && !isValidColombianPhone(phone)) rowErrors.push('Teléfono colombiano inválido')
      if (qty < 1) rowErrors.push('Cantidad mínima: 1')

      return {
        name,
        cedula,
        phone,
        email,
        quantity: qty,
        isValid: rowErrors.length === 0,
        errors: rowErrors,
      }
    })
  }, [])

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setFileName(file.name)

      if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
        toastError('Formato no soportado', 'Solo se aceptan archivos .csv o .txt')
        resetState()
        return
      }

      const reader = new FileReader()
      reader.onload = (event) => {
        const text = event.target?.result as string
        const rows = parseCSV(text)
        if (rows.length === 0) {
          toastError('Archivo vacío o formato inválido', 'El archivo no contiene registros válidos')
          resetState()
          return
        }
        setParsedRows(rows)
        setStep('preview')
      }
      reader.readAsText(file)
      e.target.value = ''
    },
    [parseCSV, toastError, resetState]
  )

  const handleImport = () => {
    const validRows: ImportCsvRow[] = parsedRows
      .filter((r) => r.isValid)
      .map((r) => ({
        name: r.name,
        cedula: r.cedula || null,
        phone: r.phone || null,
        email: r.email || null,
        quantity: r.quantity,
      }))

    if (validRows.length === 0) {
      warning('Sin registros válidos', 'No hay filas válidas para importar')
      return
    }

    importMutation.mutate(
      { eventId, rows: validRows },
      {
        onSuccess: (data) => {
          if (!data) return
          success(
            'Importación completada',
            `${data.imported} participantes importados` +
              (data.errors.length > 0 ? ` (${data.errors.length} omitidos)` : '')
          )
          setStep('done')
          setTimeout(handleClose, 1500)
        },
        onError: (err) => {
          toastError('Error en importación', err.message)
        },
      }
    )
  }

  const validCount = parsedRows.filter((r) => r.isValid).length
  const errorCount = parsedRows.filter((r) => !r.isValid).length

  if (!isOpen) return null

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className={`fixed inset-y-0 right-0 z-50 w-[480px] border-l shadow-2xl ${t.drawerHeader} ${t.drawerBg}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center justify-between border-b px-6 py-4 ${t.border}`}>
            <div>
              <h2 className={`text-lg font-semibold ${t.textPrimary}`}>Importar CSV</h2>
              <p className={`text-xs mt-0.5 ${t.textMuted}`}>
                {step === 'upload'
                  ? 'Sube un archivo .csv con los participantes'
                  : step === 'preview'
                  ? `${parsedRows.length} registros encontrados`
                  : 'Importación completada'}
              </p>
            </div>
            <button
              onClick={handleClose}
              className={`rounded-lg p-2 transition-colors ${t.iconBtn}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            {step === 'upload' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-16 hover:border-emerald-500/50 transition-colors cursor-pointer ${
                  theme === 'dark' ? 'border-gray-700' : 'border-gray-300'
                }`}
              >
                <svg
                  className={`h-12 w-12 mb-4 ${t.textFaint}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <p className={`text-sm font-medium ${t.textSecondary}`}>
                  Haz click o arrastra un archivo CSV
                </p>
                <p className={`mt-1 text-xs ${t.textFaint}`}>
                  Columnas esperadas: nombre, cédula, teléfono, email, cantidad
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            )}

            {step === 'preview' && (
              <div className="space-y-4">
                <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${t.border} ${t.surfaceAlt}`}>
                  <svg className={`h-5 w-5 ${t.textMuted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${t.textPrimary}`}>{fileName}</p>
                    <p className={`text-xs ${t.textMuted}`}>
                      {parsedRows.length} filas totales
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className={`rounded-lg border px-3 py-2 text-center ${t.border} ${t.surfaceAlt}`}>
                    <p className={`text-lg font-bold ${t.textPrimary}`}>{parsedRows.length}</p>
                    <p className={`text-xs ${t.textMuted}`}>Total</p>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 text-center ${
                    theme === 'dark'
                      ? 'border-emerald-800/50 bg-emerald-900/20'
                      : 'border-emerald-200 bg-emerald-50'
                  }`}>
                    <p className={`text-lg font-bold ${t.okText}`}>{validCount}</p>
                    <p className={`text-xs ${t.textMuted}`}>Válidos</p>
                  </div>
                  <div className={`rounded-lg border px-3 py-2 text-center ${
                    theme === 'dark'
                      ? 'border-red-800/50 bg-red-900/20'
                      : 'border-red-200 bg-red-50'
                  }`}>
                    <p className={`text-lg font-bold ${t.dangerText}`}>{errorCount}</p>
                    <p className={`text-xs ${t.textMuted}`}>Con errores</p>
                  </div>
                </div>

                <div className="space-y-1 max-h-64 overflow-y-auto">
                  {parsedRows.slice(0, 50).map((row, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs ${
                        row.isValid
                          ? `${t.surfaceAlt} ${t.textSecondary}`
                          : `${
                              theme === 'dark'
                                ? 'bg-red-900/20 text-red-400'
                                : 'bg-red-50 text-red-700'
                            }`
                      }`}
                    >
                      <span className={`font-medium w-6 ${t.textMuted}`}>{i + 1}</span>
                      <span className="flex-1 truncate">{row.name || '(sin nombre)'}</span>
                      {row.cedula && <span className={t.textMuted}>CC {row.cedula}</span>}
                      {row.phone && <span className={t.textMuted}>{row.phone}</span>}
                      {!row.isValid && (
                        <span className={`${t.dangerText} text-[10px]`}>
                          {row.errors.join(', ')}
                        </span>
                      )}
                    </div>
                  ))}
                  {parsedRows.length > 50 && (
                    <p className={`text-center text-xs py-2 ${t.textFaint}`}>
                      ... y {parsedRows.length - 50} filas más
                    </p>
                  )}
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className={`flex flex-col items-center justify-center py-16 ${t.okText}`}>
                <svg className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium">Importación Exitosa</p>
                <p className="text-sm text-gray-500 mt-1">
                  Cerrando automáticamente...
                </p>
              </div>
            )}
          </div>

          {step === 'preview' && (
            <div className={`border-t px-6 py-4 ${t.border}`}>
              <div className="flex gap-3">
                <button
                  onClick={resetState}
                  className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${t.btnGhost}`}
                >
                  Volver
                </button>
                <button
                  onClick={handleImport}
                  disabled={validCount === 0 || importMutation.isPending}
                  className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                  {importMutation.isPending
                    ? 'Importando...'
                    : `Importar ${validCount} participantes`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
