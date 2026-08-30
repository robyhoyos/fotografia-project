# Fotografia App

Aplicación de escritorio para la gestión de eventos fotográficos y sus participantes.

## Descripción

Sistema diseñado para fotógrafos independientes que manejan eventos como comuniones, bodas, bautizos, retratos escolares y sesiones de estudio. Permite gestionar cientos de participantes por evento con seguimiento de entregas y pagos.

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

# Generar Prisma Client
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar en modo desarrollo
npm run dev
```

## Scripts

| Script | Descripción |
|--------|-------------|
| `npm run dev` | Inicia Vite + Electron en modo desarrollo |
| `npm run build` | Build de producción (renderer + main + preload) |
| `npm run start` | Build completo y lanza la app |
| `npm run prisma:studio` | Abre Prisma Studio para inspeccionar la DB |
| `npm run prisma:migrate` | Ejecuta migraciones pendientes |

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
- No se puede marcar un participante como ENTREGADO sin 50% de pago mínimo
- No se puede reactivar un participante cancelado
- Máximo 500 participantes por operación masiva
- Máximo 1000 registros por importación CSV

## Seguridad

- `contextIsolation: true` — Renderer aislado
- `nodeIntegration: false` — Sin acceso a Node.js desde el renderer
- Content Security Policy habilitada
- Validación Zod en cada endpoint IPC
- Preload solo expone `window.api` con canales predefinidos
