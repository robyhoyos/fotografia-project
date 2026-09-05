// src/renderer/src/hooks/useRole.ts
// Hook para conocer el rol y los permisos del usuario autenticado en el renderer.
//
// NOTA: La seguridad real está en el Main process (guardias requireRole).
// Este hook solo refleja el rol para ocultar/deshabilitar acciones en la UI
// y mejorar la experiencia del rol "ayudante" (solo lectura).

import { useAuthStore } from '../stores/auth.store'

export function useRole() {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const role = useAuthStore((s) => s.role)

  return {
    role,
    isAdmin,
    // true cuando el usuario NO puede modificar datos (rol ayudante)
    readOnly: !isAdmin,
    // true cuando puede gestionar pagos y generar facturas (ADMIN y AYUDANTE)
    canManagePayments: isAdmin || role === 'AYUDANTE',
  }
}
