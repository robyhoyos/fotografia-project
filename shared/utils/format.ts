// shared/utils/format.ts
// Utilidades de formato compartidas entre Main y Renderer.
// Moneda: Pesos Colombianos (COP) — sin decimales.

/**
 * @function formatCOP
 * @description Formatea un número como pesos colombianos (COP).
 * Ejemplo: 150000 → "$150.000", 2500 → "$2.500"
 *
 * @param {number} amount - Monto a formatear
 * @returns string formateado como "$1.234.567"
 */
export function formatCOP(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CO')}`
}
