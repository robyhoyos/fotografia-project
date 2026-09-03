# Informe de Diseño Frontend — Portfolio Studio

> Aplicación de gestión fotográfica para estudio profesional  
> **Stack**: Electron + React 19 + TypeScript + Tailwind CSS + Vite  
> **Base de datos**: SQLite (Prisma ORM)  
> **Estado**: Zustand + TanStack Query  
> **Versión**: 1.0.0

---

## 1. Dirección Estética

### Identidad Visual

La aplicación adopta una dirección **editorial de estudio fotográfico** — minimalista oscura con acentos esmeralda, evocando la sofisticación de una revista de fotografía de alta gama. El nombre "Portfolio Studio" define el tono: herramienta profesional para profesionales creativos.

### Paleta de Color

| Token | Modo Oscuro | Modo Claro | Uso |
|-------|-------------|------------|-----|
| `--accent` | `#22c55e` (Emerald 500) | `#22c55e` | Acento de marca, CTAs primarios |
| `--accent-strong` | `#15803d` (Emerald 700) | — | Hover states, sombras de acento |
| Sidebar | `#0a0a0a` | `#0a0a0a` | Siempre oscura (identidad fija) |
| Page BG | `#121212` | `#F6F7F9` | Superficie principal |
| Card BG | `rgba(255,255,255,0.05)` | `#FFFFFF` | Tarjetas, paneles flotantes |

**Decisión de diseño**: El sidebar se mantiene oscuro en ambos temas, creando una ancla visual estable que ancla la identidad de marca sin importar el tema activo.

### Tipografía

- **Display (títulos)**: `'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Palatino, Georgia` — Serif editorial que aporta carácter y distinción a los encabezados.
- **Body (cuerpo)**: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif` — Stack nativo del sistema para legibilidad óptima.
- **Jerarquía**: Los títulos (`h1-h5`) usan la serif de carácter automáticamente via CSS. Los botones y badges mantienen sans-serif para contraste funcional.

**Evitado**: Inter, Space Grotesk, Roboto como fuente display. Se eligió serif clásica para transmitir "estudio fotográfico" con herencia editorial.

### Elementos Decorativos

- **Retícula sutil** en el panel de login (0.13% opacidad) — referencia a grillas de composición fotográfica
- **Halo esmeralda** con blur — atmosfera de estudio con iluminación indirecta
- **Bordes semitransparentes** (`border-white/10`) — jerarquía sin dureza visual
- **Scrollbar personalizada** — 8px de ancho, tonos grises sutiles

---

## 2. Componentes UI

### Layout Principal

```
┌──────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────────────┐│
│ │          │ │  Header (breadcrumb + acciones)           ││
│ │ Sidebar  │ ├──────────────────────────────────────────┤│
│ │  w-56px  │ │                                          ││
│ │          │ │  Contenido principal                      ││
│ │ Nav items│ │  (tablas, formularios, dashboards)        ││
│ │          │ │                                          ││
│ │──────────│ │                                          ││
│ │ Backup   │ │                                          ││
│ │ Restore  │ │                                          ││
│ │──────────│ │                                          ││
│ │ Usuario  │ │                                          ││
│ └──────────┘ └──────────────────────────────────────────┘│
│                                          [Drawer overlay] │
└──────────────────────────────────────────────────────────┘
```

- **Sidebar**: 224px fijo, collapsable. Navegación con indicador `border-l-2` en esmeralda.
- **Main**: Flex-1 con `overflow-y-auto` para scroll independiente.
- **Drawers**: Paneles laterales deslizantes (`slide-in-right`) para creación/edición.
- **Botón "Atrás"**: Aparece contextualmente cuando hay historial de navegación.

### LoginPage

**Dirección**: Layout dividido 46/54 — panel de marca (izq) + formulario de acceso (der).

- **Panel izquierdo**: Fondo `#0b0e0d`, retícula decorativa, halo esmeralda, titular serif editorial con copywriting de marca.
- **Panel derecho**: Formulario limpio sobre `#0f1412`, inputs con borde `white/10`, botón emerald sólido.
- **Estados**: `setup` (primer admin) y `login` (acceso existente).
- **Microinteracciones**: `animate-slide-in-up` escalonado con `animation-delay` para entrada fluida.
- **Seguridad visual**: Indicador "Acceso restringido" en el pie, toggle de visibilidad de contraseña.

### Tablas

- **EventTable**: Muestra nombre, categoría, subtipo, fecha, precio, participantes, estado.
- **ParticipantTable**: Nombre, cédula, teléfono, código de barras, estado, pago, calificación.
- **Estilo**: Headers con fondo sólido oscuro (`#1F2937`), filas transparentes con hover sutil.
- **Selección múltiple**: Checkboxes con accent emerald, acciones masivas (cambio de estado, eliminación).
- **Paginación**: Botones Anterior/Siguiente con estilo ghost.

### StatCards

Cards de métricas con:
- Label uppercase tracking-wider en muted
- Valor grande bold con color contextual (emerald para positivo, amber para pendiente)
- Bordes semitransparentes + fondo glassmorphism

### Badges de Estado

Sistema de 7 colores semánticos:
- `badgeEmerald`: Entregado / Activo
- `badgeAmber`: Pendiente / En proceso
- `badgeRed`: Cancelado
- `badgeBlue`: Informativo
- `badgeGray`: Inactivo
- `badgePurple`: Especial
- `badgeOrange`: Advertencia

Todos con opacidad 20% en fondo + borde 30% en modo oscuro.

### Drawers (Paneles Laterales)

- **EventDrawer**: Crear/editar eventos con categoría, subtipo, precio, fecha.
- **ParticipantDrawer**: Alta de participantes con datos personales, items de compra, código de barras.
- **PaymentDrawer**: Registro de pagos con método, monto, notas.
- **CsvImportDrawer**: Importación masiva de participantes desde CSV.

**Animación**: `slide-in-right` 0.3s ease-out, overlay `bg-black/60`.

### ConfirmDialog

Modal de confirmación con variantes:
- `danger` (rojo): Eliminaciones
- `warning` (amber): Cambios de estado, navegación con cambios sin guardar
- `info`: Información general

### BarcodeScanner

Componente para escaneo de códigos de barras de participantes — permite entrega rápida en campo.

### PrintView

Vista de impresión optimizada para listados de participantes con datos de contacto y estado de pago.

---

## 3. Sistema de Temas

### Arquitectura

```typescript
// theme.ts — Fuente única de verdad
useThemeTokens() → ThemeTokens (40+ propiedades)
  ├── DARK:  bg #121212, text white, cards glassmorphism
  └── LIGHT: bg #F6F7F9, text gray-900, cards white sólido
```

**Decisión clave**: Sidebar siempre oscura (`bg-[#0a0a0a]`) en ambos temas. Esto:
1. Mantiene la identidad de marca
2. Evita el parpadeo al cambiar tema
3. Crea contraste natural con el contenido

### Tokens Semánticos

El sistema define **40+ tokens** que encapsulan clases Tailwind:
- `pageBg`, `textPrimary`, `textSecondary`, `textMuted`
- `cardBg`, `border`, `borderStrong`, `divider`
- `input`, `btnGhost`, `iconBtn`
- `badge[Color]` (7 variantes)
- `drawerBg`, `overlay`, `floatingBar`

**Uso**: `className={`${t.cardBg} ${t.border} ${t.textPrimary}`}` — nunca clases hardcodeadas en componentes.

---

## 4. Arquitectura de Componentes

### Estructura

```
src/renderer/src/
├── App.tsx                    # Root: auth gate + AppShell
├── main.tsx                   # Entry point
├── index.css                  # Tailwind + global styles + animations
├── lib/
│   ├── theme.ts               # Theme tokens (fuente única)
│   ├── format.ts              # Formateo COP, fechas
│   └── currencyInput.ts       # Input de moneda
├── stores/
│   ├── ui.store.ts            # Sidebar, drawer, tema, navegación
│   └── auth.store.ts          # Sesión, roles, usuario
├── hooks/
│   ├── useEvents.ts           # CRUD eventos (TanStack Query)
│   ├── useParticipants.ts     # CRUD participantes
│   ├── usePayments.ts         # CRUD pagos
│   ├── useAlerts.ts           # Incidencias/alertas
│   ├── useDashboard.ts        # Estadísticas globales
│   ├── useCustomers.ts        # Clientes registrados
│   ├── useExport.ts           # Exportación Excel
│   ├── usePdf.ts              # Generación PDF
│   ├── useSettings.ts         # Configuración app
│   ├── useUsers.ts            # Gestión de usuarios
│   ├── useRole.ts             # RBAC (admin/ayudante)
│   └── useToast.ts            # Notificaciones
├── pages/
│   ├── EventsPage.tsx         # Vista principal (eventos + participantes)
│   ├── LoginPage.tsx          # Autenticación
│   ├── SettingsPage.tsx       # Configuración (admin)
│   ├── AlertsPage.tsx         # Incidencias
│   └── ClientsPage.tsx        # Directorio de clientes
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx        # Navegación lateral
│   ├── tables/
│   │   ├── EventTable.tsx     # Tabla de eventos
│   │   └── ParticipantTable.tsx # Tabla de participantes
│   ├── drawers/
│   │   ├── EventDrawer.tsx    # Crear/editar eventos
│   │   ├── ParticipantDrawer.tsx # Crear/editar participantes
│   │   ├── PaymentDrawer.tsx  # Registrar pagos
│   │   └── CsvImportDrawer.tsx # Importación CSV
│   ├── dashboard/
│   │   └── StatsDashboard.tsx # Métricas globales
│   └── ui/
│       ├── Toaster.tsx        # Notificaciones toast
│       ├── ConfirmDialog.tsx  # Modales de confirmación
│       ├── BarcodeScanner.tsx # Escáner de códigos
│       ├── PrintView.tsx      # Vista de impresión
│       ├── PaymentHistory.tsx # Historial de pagos
│       └── ErrorBoundary.tsx  # Manejo de errores
```

### Patrones de Estado

- **UI**: Zustand (`ui.store`) — sidebar, drawer, tema, navegación con stack
- **Auth**: Zustand (`auth.store`) — sesión, roles, RBAC
- **Datos**: TanStack Query — cache, mutaciones, optimistic updates
- **Forms**: Estado local React (`useState`)

### RBAC (Control de Acceso)

```
ADMIN:    Acceso total (CRUD eventos, pagos, clientes, config, backup)
AYUDANTE: Solo lectura (ver eventos, participantes, dashboard, alertas)
```

La restricción se aplica en:
- `Sidebar.tsx`: Filtra `ADMIN_ONLY_VIEWS` (clients, settings)
- `EventsPage.tsx`: Oculta botones de crear/editar/eliminar
- `App.tsx`: Bloquea `ClientsPage` y `SettingsPage`

---

## 5. Animaciones y Microinteracciones

| Animación | Duración | Uso |
|-----------|----------|-----|
| `slide-in-right` | 0.3s ease-out | Drawers laterales |
| `slide-in-up` | 0.25s ease-out | LoginPage elementos, errores |
| `ping` (Tailwind) | 1.5s infinite | Indicador de actividad (dot esmeralda) |
| `spin` | 1s linear infinite | Loading states |
| `animation-delay` escalonado | 0.05s-0.3s | Entrada secuencial de elementos |

**Decisión**: Animaciones CSS-only para máximo rendimiento en Electron. No se usa biblioteca de animación externa.

---

## 6. Funcionalidades Clave

### Gestión de Eventos
- 3 categorías: Sacramental, Escolar, Estudio
- 11 subtipos específicos (Boda, Comunión, Bautizo, Retrato familiar, etc.)
- Estados: Activo → Finalizado / Cancelado
- Precio base por participante en COP

### Gestión de Participantes
- Datos: nombre, cédula, teléfono, email, notas
- Items de compra (array JSON con descripción, cantidad, precio)
- Código de barras único por participante
- Estados de entrega: Pendiente → En proceso → Entregado / Cancelado
- Estados de pago: Sin pago → Pago parcial → Pago total
- Calificación del cliente (1-3)
- Importación masiva desde CSV

### Pagos
- Ledger completo por participante
- Métodos: efectivo, transferencia, Nequi, Daviplata, etc.
- Historial de transacciones con timestamps

### Escáner de Códigos
- Escaneo de código de barras para entrega rápida
- Asociado a evento específico

### Dashboard
- Métricas globales del estudio
- Navegación directa a eventos desde estadísticas

### Alertas/Incidencias
- Tipos: Equipo dañado, Accesorio por comprar, Pendiente
- Estados: Abierta → Resuelta
- Asociación opcional a eventos
- Fecha límite opcional

### Backup/Restauración
- Respaldo de base de datos SQLite
- Restauración con confirmación de seguridad

### Exportación
- Excel (.xlsx) con datos de participantes
- PDF con formato de recibo/impresión
- Impresión directa desde el navegador

### Configuración
- Nombre del negocio y tagline (personalización del sidebar)
- Solo accesible por admin
- Guardia de cambios sin guardar al navegar

---

## 7. Accesibilidad y UX

### Fortalezas
- **Focus visible**: `outline: 2px solid var(--accent)` en inputs y botones
- **Labels**: Todos los inputs tienen labels descriptivos
- **Contraste**: Colores sobre fondo oscuro superan WCAG AA
- **Estados de carga**: Spinners y deshabilitación de botones durante operaciones
- **Confirmación**: Diálogos de confirmación para acciones destructivas
- **RBAC visual**: Rol visible en el sidebar (Administrador / Ayudante)
- **Guardia de navegación**: Advertencia al salir con cambios sin guardar
- **Toasts**: Feedback inmediato para CRUD exitoso/fallido

### Oportunidades de Mejora
- **Responsive**: La aplicación está diseñada para desktop (Electron) — no tiene breakpoints móvil
- **Alt text**: Iconos SVG son decorativos (aria-hidden), pero falta aria-label en algunos botones
- **Keyboard navigation**: No hay trap de foco en drawers/modales
- **Screen reader**: Los estados de badge no tienen aria-label (solo color)

---

## 8. Resumen de Decisiones de Diseño

| Decisión | Justificación |
|----------|---------------|
| Sidebar siempre oscura | Identidad de marca estable, contraste natural |
| Serif para títulos | Evoca revista editorial / estudio fotográfico |
| Emerald como acento | Frescura, profesionalismo, asociación con calidad |
| CSS-only animations | Rendimiento óptimo en Electron, sin bundle extra |
| Theme tokens centralizados | Consistencia, un solo punto de verdad, fácil mantenimiento |
| Glassmorphism sutil | Profundidad sin excesivo decoration, modernidad |
| Drawers para CRUD | No pierde contexto de la tabla al editar |
| Confirm dialogs | Prevención de errores en acciones destructivas |
| RBAC en UI + backend | Seguridad en capa visual y de datos |

---

## 9. Score de Diseño

| Criteria | Puntuación | Notas |
|----------|------------|-------|
| **Consistencia visual** | 9/10 | Tokens centralizados, paleta coherente |
| **Jerarquía tipográfica** | 9/10 | Serif display + sans body, tamaños bien escalados |
| **Paleta de color** | 8/10 | Emerald sofisticado, evitaría más contraste en light mode |
| **Animaciones** | 7/10 | Funcionales pero podrían ser más expresivas |
| **Accesibilidad** | 6/10 | Focus y labels OK, falta keyboard trap y aria |
| **Responsividad** | 4/10 | Solo desktop (Electron), sin breakpoints móvil |
| **Originalidad** | 8/10 | Estética editorial distinguible, no genérica |
| **Profundidad visual** | 8/10 | Glassmorphism, halos, retícula decorativa |

**Score General: 7.4/10** — Excelente identidad visual para una aplicación de nicho. Las principales oportunidades están en accesibilidad (keyboard, aria) y responsive (si se requiere web).

---

*Generado aplicando la skill `frontend-design` — enfoque en dirección estética, tokens semánticos, y decisiones de diseño justificadas.*
