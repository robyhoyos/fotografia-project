// src/renderer/src/lib/currencyInput.ts
// Hook para inputs de moneda con separador de miles (COP).
// Muestra el punto de mil/millón mientras se escribe, y expone el valor
// numérico subyacente para su persistencia.

import { useState } from 'react'

/**
 * @function stripNonDigits
 * @description Elimina todo excepto dígitos de un string de monto.
 */
function stripNonDigits(value: string): string {
  return value.replace(/[^0-9]/g, '')
}

/**
 * @function formatThousands
 * @description Agrupa dígitos en miles usando punto (ej. 1234567 → 1.234.567).
 * Solo agrupa la parte entera, dejando los decimales intactos.
 */
function formatThousands(value: string): string {
  const [intPart, decPart] = value.split('.')
  const digits = stripNonDigits(intPart)
  if (!digits) return decPart !== undefined ? `.${decPart}` : ''

  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

  if (decPart !== undefined) {
    const dec = stripNonDigits(decPart)
    return dec ? `${grouped}.${dec}` : `${grouped}.`
  }
  return grouped
}

interface UseCurrencyInputResult {
  /** Texto formateado con separador de miles para mostrar en el input. */
  displayValue: string
  /** Valor numérico (parseFloat) del monto, o 0 si no hay valor. */
  amount: number
  /** Handler para el onChange del input. */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Limpia el campo. */
  reset: () => void
  /** Establece el monto programáticamente (ej. para botones rápidos). */
  set: (value: number | string) => void
}

/**
 * @hook useCurrencyInput
 * @description Hook que mantiene un string formateado con separador de miles
 * y un valor numérico. Al escribir, formatea automáticamente con punto de mil
 * (y de millón, etc.).
 *
 * @param initial - Valor inicial (opcional).
 * @returns Objeto con displayValue, amount, onChange, reset y set.
 */
export function useCurrencyInput(initial: number | string = ''): UseCurrencyInputResult {
  const [displayValue, setDisplayValue] = useState(() =>
    typeof initial === 'number' && initial > 0
      ? formatThousands(String(initial))
      : typeof initial === 'string'
        ? formatThousands(initial)
        : ''
  )

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Si el usuario borra, o ingresa solo decimales, mantener el formato limpio.
    setDisplayValue(formatThousands(raw))
  }

  const amount = displayValue ? parseFloat(displayValue.replace(/\./g, '')) || 0 : 0

  const reset = () => setDisplayValue('')

  const set = (value: number | string) => {
    if (typeof value === 'number') {
      setDisplayValue(value > 0 ? formatThousands(String(value)) : '')
    } else {
      setDisplayValue(formatThousands(value))
    }
  }

  return { displayValue, amount, onChange, reset, set }
}
