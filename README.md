# Fotografia App

Aplicación de escritorio para la gestión del ciclo comercial de fotógrafos independientes.

## Descripción

FotoVic permite gestionar el ciclo comercial completo: crear evento → registrar participantes → registrar pagos → controlar entregas → exportar / imprimir recibos. Está diseñada para fotógrafos independientes que manejan eventos como comuniones, bodas, bautizos, retratos escolares y sesiones de estudio, permitiendo gestionar cientos de participantes por evento con seguimiento de entregas y pagos.

> **Nota sobre el alcance:** la aplicación no almacena ni gestiona fotografías digitales ni archivos multimedia. El término "entrega" se refiere al control de la **entrega física de las fotografías impresas** de cada participante (estado PENDIENTE / EN_PROCESO / ENTREGADO).

## Stack Tecnológico

- **Electron** ^33.3 — Shell de escritorio
- **React** ^19.1 — UI
- **TypeScript** ^5.7 — Tipado estático
- **Vite** ^6.0 — Bundler y dev server
- **Prisma** ^6.9 — ORM
- **SQLite** — Base de datos local
- **TanStack React Query** ^5.64 — Estado del servidor
- **Zustand** ^5.0 — Estado de UI
- **Zod** ^3.24 — Validación de schemas
- **Tailwind CSS** ^3.4 — Estilos

## Instalación

```bash
# Instalar dependencias
npm install

# Generar Prisma Client (usar el script definido en package.json)
npm run prisma:generate

# Ejecutar migraciones pendientes (usar el script definido en package.json)
npm run prisma:migrate

# Iniciar en modo desarrollo
npm run dev
```

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Genera Prisma Client e inicia Vite + Electron en modo desarrollo |
| `npm run build` | Build de producción (renderer + main + preload) |
| `npm run start` | Genera Prisma Client, build completo y lanza la app |
| `npm run lint` | Ejecuta ESLint |
| `npm run typecheck` | Verificación de tipos sobre los 3 tsconfigs |
| `npm run prisma:generate` | Genera Prisma Client |
| `npm run prisma:migrate` | Ejecuta migraciones pendientes |
| `npm run prisma:studio` | Abre Prisma Studio para inspeccionar la DB |

## Arquitectura

```
src/
├── main/                    # Proceso principal de Electron
│   ├── database/            # Prisma Client singleton
│   ├── repositories/        # Capa de acceso a datos
│   ├── services/            # Lógica de negocio
│   └── handlers/            # Handlers IPC con validación Zod
├── preload/                 # Puente de seguridad (contextBridge)
└── renderer/                # React Frontend
    └── src/
        ├── components/      # Componentes UI
        │   ├── tables/      # Tablas de eventos y participantes
        │   ├── drawers/     # Paneles laterales
        │   ├── layout/      # Sidebar
        │   ├── dashboard/   # Dashboard de estadísticas
        │   └── ui/          # Toaster, ConfirmDialog, BarcodeScanner
        ├── hooks/           # TanStack Query hooks
        ├── pages/           # Páginas principales
        └── stores/          # Zustand store

shared/                      # Código compartido (Main + Renderer)
├── types/                   # Tipos IPC e interfaces
└── schemas/                 # Schemas Zod de validación
```

## Funcionalidades

### Implementadas
- CRUD completo de eventos (crear, editar, eliminar)
- CRUD de participantes con generación automática de códigos de barras
- Selección múltiple con acciones masivas (cambiar estado, eliminar)
- Importación masiva desde archivos CSV
- Registro de pagos por participante
- Escáner de códigos de barras para entregas rápidas
- Dashboard de estadísticas
- Búsqueda y filtrado en eventos y participantes
- Paginación
- Tema oscuro/claro con persistencia
- Validación en cada capa (Zod en handlers, reglas de negocio en services)
- Optimistic updates para cambios de estado

### Reglas de Negocio
- No se pueden crear eventos con fecha en el pasado (excepto ESTUDIO)
- No se pueden modificar eventos cancelados
- No se pueden eliminar eventos con participantes entregados
- No se puede marcar un participante como ENTREGADO sin alcanzar el porcentaje mínimo de pago configurable (`delivery_payment_threshold`, por defecto 50% sobre el total adeudado)
- No se puede reactivar un participante cancelado
- Máximo 500 participantes por operación masiva
- Máximo 1000 registros por importación CSV

## Seguridad

- `contextIsolation: true` — Renderer aislado
- `nodeIntegration: false` — Sin acceso a Node.js desde el renderer
- Content Security Policy habilitada
- Validación Zod en cada endpoint IPC
- Preload solo expone `window.api` con canales predefinidos
