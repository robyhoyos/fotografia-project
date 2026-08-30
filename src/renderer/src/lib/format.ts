// src/renderer/src/lib/format.ts
// Utilidades de formato para el renderer.
// Re-exporta desde shared para mantener una sola fuente de verdad.

export { formatCOP } from '../../../../shared/utils/format'

/**
 * @function formatDate
 * @description Formatea una fecha ISO string a formato local colombiano.
 * Ejemplo: "2026-08-26T10:00:00Z" → "26/08/2026"
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO')
}

/**
 * @function formatDateLong
 * @description Formatea una fecha ISO string a formato largo en español.
 * Ejemplo: "2026-08-26" → "26 de agosto de 2026"
 */
export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}
