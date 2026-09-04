# Documento Técnico — Gestión Fotográfica (FotoVic)

> **Documento de verificación técnica revisado a fecha actual** contra el código real del repositorio.
> Alcance del negocio: **NO se gestionan fotos**. La aplicación gestiona el **ciclo comercial**: crear evento → registrar participantes → registrar pagos → controlar entregas → exportar/recibir.



## 1. Descripción del producto

Aplicación **de escritorio** (Electron + React + SQLite) para **fotógrafos independientes**. El flujo de negocio central es:

```
Crear evento → Registrar participantes → Cobrar (pagos / ledger) → Entregar (barcode + umbral de pago) → Exportar / imprimir recibos
```

No hay módulo de gestión ni almacenamiento de fotos, archivos multimedia o entrega digital de imágenes. La palabra "entrega" se refiere a la entrega física de fotos impresas; el sistema solo lleva el **control de estado** de esa entrega (PENDIENTE / EN_PROCESO / ENTREGADO) y el **estado de pago**.

---

## 2. Stack tecnológico (verificado, versiones instaladas)

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Shell de escritorio | **Electron** | ^33.3.0 |
| UI | **React** | ^19.1.0 |
| Idioma de UI / tipos | **TypeScript** | ^5.7.0 |
| Bundler & dev server | **Vite** | ^6.0.0 |
| Plugin React | @vitejs/plugin-react | ^4.3.0 |
| Estilos | **Tailwind CSS** | ^3.4.17 |
| Estado de UI | **Zustand** | ^5.0.0 |
| Estado de servidor (BD) | **TanStack React Query** | ^5.64.0 |
| Validación | **Zod** | ^3.24.0 |
| ORM | **Prisma** | ^6.9.0 (`@prisma/client` ^6.9.0) |
| Base de datos | **SQLite** | — (embebida, driver de Prisma) |
| Hash de contraseñas | **bcryptjs** | ^3.0.3 |
| Generación de recibos PDF | **pdfkit** | ^0.20.1 |
| Exportación XLSX | **exceljs** | ^4.4.0 |
| Empaquetado instalador | **electron-builder** | ^25.1.8 |
| Tests E2E | **Playwright Test** | ^1.62.1 |
| Linter | **ESLint** | ^9.39.5 |

Entorno de ejecución: **Node v20.17.0**, **npm 10.8.2**.

---

## 3. Arquitectura en 3 capas

```
┌────────────────────────────────────────────────────────────────┐
│ RENDERER (React 19) — frontend                                 │
│  • Accede SOLO a window.api (inyectado por el preload)         │
│  • Nunca importa electron / fs / path                          │
│  • Estado UI: Zustand · Estado servidor: React Query           │
└───────────────────────────────┬────────────────────────────────┘
                                │ window.api.<dominio>.<metodo>()
                                ▼
┌────────────────────────────────────────────────────────────────┐
│ PRELOAD (contextBridge) — puente seguro tipado                 │
│  • Expone una API selectiva, canales predefinidos              │
│  • Envuelve ipcRenderer.invoke()                               │
└───────────────────────────────┬────────────────────────────────┘
                                │ ipcMain.handle()
                                ▼
┌────────────────────────────────────────────────────────────────┐
│ MAIN (Electron) — lógica de negocio y datos                    │
│  Handler (IPC) → Service (reglas) → Repository (Prisma) → SQLite
│  Protegido por guardias de rol (requireAdmin / requireRole)    │
└────────────────────────────────────────────────────────────────┘
```

### Patrón por dominio (backend / Main)
```
Handler → validación Zod → Service (reglas de negocio) → Repository (Prisma Client) → SQLite
```

### Organización de directorios
```
src/
├── main/                    # Proceso principal de Electron (el "backend")
│   ├── auth/                # Guardias de permisos (requireAuth/role/admin)
│   ├── database/            # Singleton Prisma, resolución de rutas, bootstrap, backup
│   ├── repositories/        # Capa de acceso a datos (Prisma)
│   ├── services/            # Lógica de negocio (event, participant, payment, …)
│   └── handlers/            # Handlers IPC + validación Zod + permisos
├── preload/                 # Puente de seguridad (contextBridge → window.api)
├── renderer/                # React Frontend
│   └── src/
│       ├── components/      # tables/, drawers/, layout/, dashboard/, ui/
│       ├── hooks/           # Hooks de TanStack Query
│       ├── pages/           # Páginas principales
│       ├── stores/          # Zustand (ui.store, auth.store)
│       └── lib/             # tema (design tokens), utilidades

shared/                      # Código compartido (Main + Renderer)
├── types/                   # Contrato IPC tipado (canales, DTO, ApiResponse)
├── schemas/                 # Schemas Zod de validación
└── utils/                   # utilidades (p.ej. formatCOP)
```

### Configs de build (3 tsconfigs independientes)
- `tsconfig.json` → renderer + `shared/` (outDir `dist/renderer`)
- `tsconfig.main.json` → proceso main (outDir `dist/main`)
- `tsconfig.preload.json` → preload (compilado a CJS)
- Aliases Vite: `@` → `src/renderer/src`, `@shared` → `shared/`
- Puerto de desarrollo: **5173** con `strictPort: true`
- CSP habilitada en `index.html`

---

## 4. Frontend (Renderer)

### Bootstrapping y providers
- `main.tsx`: crea `QueryClient` (staleTime 30s, gcTime 5min, refetchOnWindowFocus, retry 1) y monta en `React.StrictMode` + `ErrorBoundary` + `QueryClientProvider`.
- `App.tsx`: auth-splash → Login (setup/login) → `AppShell`.

### Estado global (Zustand)
- **`ui.store.ts`**: tema (dark/light persistido), sidebar, `activeView`, pila de navegación ("Atrás"), drawers, selección múltiple de participantes, `scannerEventId`.
- **`auth.store.ts`**: sesión reactiva (`loading | unauthenticated | authenticated | setup`), `user`, `role`, `isAdmin`. La seguridad real vive en el Main; esta store solo refleja la sesión.

### Vistas principales (`AppView`)
`events | scanner | dashboard | alerts | clients | settings`
Solo **ADMIN** ve `clients` y `settings` (según `isAdmin`).

### Componentes clave
| Componente | Función |
|-----------|---------|
| `EventsPage` + `EventTable` | Listado paginado con filtros/orden |
| `EventDrawer` | Crear/editar evento (panel lateral) |
| `ParticipantTable` | Checkboxes, estados entrega/pago, acciones masivas, accesibilidad |
| `ParticipantDrawer` | Crear/editar participante con **Detalle de Compra** |
| `PaymentDrawer` + `PaymentHistory` | Registrar pagos y ver ledger |
| `CsvImportDrawer` | Importación masiva (CSV/Excel) con mapeo/validación |
| `BarcodeScanner` | Escáner por evento para entregas |
| `StatsDashboard` | KPIs con filtros por fecha/categoría |
| `AlertsPage` | Incidencias + eventos próximos + cuentas por cobrar |
| `ClientsPage` | Clientes únicos por cédula + rating |
| `SettingsPage` + `UsersSection` | Configuración de negocio + usuarios |
| `LoginPage` | Setup inicial de admin / login |
| UI: `ConfirmDialog`, `ErrorBoundary`, `Toaster`, `PrintView` | Diálogos, errores, toasts, impresión |

### Hooks (React Query + `window.api`)
`useEvents`, `useParticipants`, `usePayments`, `useSettings`, `useDashboard`, `useAlerts`, `useCustomers`, `useExport`, `usePdf`, `useUsers`, `useRole`, `useToast`.

### Tema (design tokens)
- Tokens semánticos centralizados en `lib/theme.ts`.
- Modo oscuro por defecto (`#121212` body, sidebar `#0a0a0a`) y modo claro (`#F6F7F9`); sidebar siempre oscura.
- Acento esmeralda + ámbar; badges por estado.

---

## 5. Backend (Main process)

### Autorización por rol (mapa verificado)
La protección **real** vive en el Main mediante guardias (`requireAdmin`, `requireRole`, `requireAuth`). Ocultar botones en la UI no es la barrera de seguridad; lo es el handler.

**Lectura — accesible con sesión (sin requisito de rol):**
- auth: `isSetup`, `logout`, `getCurrent`
- events: `getAll`, `getById`, `getStats`
- participants: lectura por evento / id / barcode
- payments: `findByParticipant`
- incidents: `getIncidents`, `getUpcomingEvents`, `getReceivables`
- dashboard: `getStats`
- settings: `getAll`, `get`, `getMany`

**Mutaciones / administrativo — SOLO ADMIN (`requireAdmin`):**
- auth: `setupAdmin`, `login`, `changePassword`, `createUser`, `listUsers`, `toggleUser`
- events: `create`, `update`, `delete`
- participants: `create`, `update`, `delete`, `bulkUpdateStatus`, `bulkUpdatePayment`, `bulkDelete`, `importCsv`
- payments: `create`, `delete`
- incidents: `create`, `update`, `delete`
- settings: `set`, `setMany`, `resetCategory`, `resetAll`
- customers: `list`, `setRating`
- export: `xlsxParticipants`
- pdf: `generateReceipt`
- database: `backup`, `restore`, `getInfo`
- dialog: `pickDirectory`

### Seguridad
- `contextIsolation: true`, `nodeIntegration: false` (renderer aislado de Node).
- CSP en `index.html`.
- Preload expone **solo** `window.api` con canales predefinidos.
- Validación Zod en **cada** handler (payload tipado).
- Contrato IPC en `shared/types/ipc.ts` (`IPC_CHANNELS`, `ApiResponse`, `AppRole`, DTO serializados).
- Contraseñas guardadas como **hash bcrypt** (salt rounds 10); el hash nunca se expone al renderer.
- Sesión activa **en memoria del Main** (app local de escritorio; no hay tokens JWT).
- `toggleUser` no permite desactivar el **último administrador activo** ni a uno mismo.

### Base de datos (Prisma + SQLite)
- ORM **Prisma** con SQLite como motor embebido.
- **Resolución de ruta** (`database/paths.ts`):
  - Dev → `<proyecto>/prisma/dev.db`
  - Producción → `app.getPath('userData')` (escribible junto al ejecutable).
- **Detalle importante (fix aplicado):** la URL de BD se construye como `file:C:/...` (no `file:///` triple-slash), porque Prisma no abre la forma triple-slash dentro de Electron. `bootstrap.ts` setea `DATABASE_URL` correctamente antes de iniciar.
- Soporta **backup / restore**.
- Empaquetado requiere `asar: false` (obligatorio por el motor nativo de Prisma).

---

## 6. Modelo de datos (`prisma/schema.prisma`)

**Jerarquía:** `Evento (1) ──► Participante (N) ──► Pago (N)`

| Modelo | Campos clave |
|--------|-------------|
| **Event** | name, category (SACRAMENTAL/ESCOLAR/ESTUDIO), subtype (10 subtipos), date, location, coverPrice, status (ACTIVO/FINALIZADO/CANCELADO) |
| **Participant** | eventId (FK), name, cedula (4-12 dígitos, opcional), phone, email, quantity, unitPrice, items (JSON "Detalle de Compra"), totalAmount, status (PENDIENTE/EN_PROCESO/ENTREGADO/CANCELADO), paymentStatus (SIN_PAGO/PAGO_PARCIAL/PAGO_TOTAL), paidAmount, deliveredAt, rating, **barcode único** |
| **Payment** | participantId (FK), amount, method, notes, createdAt — **ledger** de transacciones |
| **Incident** | title, description, type (EQUIPO_DANADO/ACCESORIO_POR_COMPRAR/PENDIENTE), status (ABIERTA/RESUELTA), eventId, dueDate |
| **User** | username (unique), passwordHash (bcrypt), role (ADMIN/AYUDANTE), displayName, isActive |
| **Setting** | key (unique), value, category, label, description |

---

## 7. Reglas de negocio implementadas (verificadas en código)

| # | Regla | Ubicación |
|---|-------|-----------|
| R1 | No crear eventos con fecha pasada, excepto categoría ESTUDIO | `event.service.ts create()` |
| R2 | No modificar eventos CANCELADOS | `event.service.ts update()` |
| R3 | No eliminar evento con participantes ENTREGADO (cancela primero) | `event.service.ts delete()` |
| R4 | No agregar participante a evento inexistente o CANCELADO | `participant.service.ts create()` |
| R5 | **ENTREGADO exige pagar al menos un umbral configurable** (`delivery_payment_threshold`, por defecto 50%). Se calcula sobre el total adeudado | `participant.service.ts update()` y `bulkUpdateStatus()` |
| R6 | Participante CANCELADO no se reactiva a EN_PROCESO | `participant.service.ts update()` |
| R7 | Acciones bulk limitadas a máx. 500 participantes | lógica de bulk |
| R8 | Importación CSV limitada a máx. 1000 registros | lógica de importación |
| R9 | La importación no duplica por nombre dentro del evento | `participant.service.ts importCsv()` (dedupe con `Set` de nombres normalizados) |
| R10 | Todo participante recibe barcode único | generación automática |
| R11 | Pagos como transacciones (ledger), no solo campo acumulado | modelo `Payment` + estructura de pagos |
| R12 | Cédula opcional, solo dígitos (4-12), usada para clientes/reutilización | schema + UI de clientes |

### Detalle de pago del participante (importante)
El total adeudado se calcula así (`getParticipantTotalDue`):
1. Si existe `totalAmount` (del **Detalle de Compra**) → se usa.
2. Si no, si hay `items` (JSON con subtotales) → suma de subtotales.
3. Si no → cálculo legado `unitPrice (o coverPrice) × quantity`.

Esto significa que el sistema soporta **ventas por ítem / "Detalle de Compra"**, además del cálculo simple por precio unitario × cantidad. El umbral mínimo de entrega NO está fijo al 50%: es **configurable**.

---

## 8. Roles y permisos de usuario

| Rol | Alcance |
|-----|---------|
| **ADMIN** | Todo: operación completa, gestión de eventos, participantes, clientes, pagos, exportaciones, backups y configuración del negocio. |
| **AYUDANTE** | **Solo lectura**: ver eventos, participantes, dashboard y alertas. No puede crear/editar/eliminar, gestionar pagos/incidencias, clientes, exportar, backups ni configuración. |

Autenticación: setup inicial crea el admin → login con bcrypt → sesión en memoria del Main.

---

## 9. Canales IPC expuestos (vía `window.api`)

- **auth**: `setupAdmin`, `isSetup`, `login`, `logout`, `getCurrent`, `changePassword`, `createUser`, `listUsers`, `toggleUser`
- **events**: `getAll`, `getById`, `create`, `update`, `delete`, `getStats`
- **participants**: `getByEvent`, `getById`, `getByBarcode`, `create`, `update`, `delete`, `bulkUpdateStatus`, `bulkUpdatePayment`, `bulkDelete`, `importCsv`
- **customers**: `list`, `setRating`
- **database**: `backup`, `restore`, `getInfo`
- **payments**: `create`, `findByParticipant`, `delete`
- **pdf**: `generateReceipt`
- **export**: `xlsxParticipants`
- **settings**: `getAll`, `get`, `set`, `getMany`, `setMany`, `resetCategory`, `resetAll`
- **dashboard**: `getStats`
- **alertas**: `getIncidents`, `createIncident`, `updateIncident`, `deleteIncident`, `getUpcomingEvents`, `getReceivables`
- **dialog**: `pickDirectory`

---

## 10. Scripts de desarrollo

| Script | Descripción |
|--------|-------------|
| `npm run dev` | `prisma:generate` → `concurrently` ("dev:renderer" + "dev:main") |
| `npm run dev:renderer` | Vite dev server (puerto 5173, strictPort) |
| `npm run dev:main` | `tsc` main → `tsc` preload (noEmit) → build preload → `electron .` |
| `npm run prisma:generate` | Genera Prisma Client |
| `npm run prisma:migrate` | Ejecuta migraciones |
| `npm run prisma:studio` | Abre Prisma Studio |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run typecheck` | Verificación de tipos |
| `npm run build` / `start` | Build de producción + lanzamiento |

**Detalle operativo:** al cerrar la ventana en desarrollo, se ejecuta `teardownDevProcess()` que dispara `prisma.$disconnect()` + `app.quit()` y mata el proceso `concurrently` (liberando el puerto 5173) sin cerrar la terminal del usuario.

---

## 11. Empaquetado (electron-builder)

- `appId: com.fotografia.gestion`
- **`asar: false`** (obligatorio: Prisma requiere acceso al motor nativo sin asar)
- Targets: **NSIS** (instalador) + **portable** (ejecutable autónomo)
- Icono: `build/icon.png`

---

## 12. Opinión técnica (rol de juez) — hallazgos y recomendaciones

**Lo que está bien consolidado:**
- Separación clara de responsabilidades (Handler → Service → Repository) con validación en cada capa y permisos **forzados en el Main**, no solo en la UI. Esto es la práctica correcta.
- Contrato IPC tipado compartido (`shared/`) que evita desincronización de tipos entre renderer y main.
- Modelo de pagos como **ledger de transacciones** (R11): diseño correcto y auditable.
- Reglas de negocio bien aisladas en `services/`, con mensajes de error en español claros al usuario.

**Observaciones / inconsistencias detectadas (todas YA corregidas):**
1. **`README.md` desactualizado**: afirmaba que la regla de entrega es un **"50% fijo"**, pero en realidad el umbral es **configurable** (`delivery_payment_threshold`, fallback 0.5). **Corregido en `README.md`**: ahora describe el porcentaje mínimo configurable.
2. **`README.md` obsoleto en scripts**: mencionaba `npx prisma migrate dev`, pero el proyecto usa en la práctica `npm run prisma:migrate` y el flujo real está centrado en `prisma generate` + `npm run dev`. **Corregido en `README.md`**: ahora indica `npm run prisma:generate` y `npm run prisma:migrate`, y la tabla de Scripts refleja los definidos en `package.json` (`dev`, `build`, `start`, `lint`, `typecheck`, `prisma:generate`, `prisma:migrate`, `prisma:studio`).
3. **Comentario engañoso en el código** (`event.service.ts delete()`): decía *"no eliminar si ya se entregaron fotos"*, pero **no se gestionan fotos**; la lógica real bloquea eventos con *participantes ENTREGADO*. **Corregido en el código**: el comentario ahora dice "no se puede eliminar un evento con participantes en estado ENTREGADO". También se corrigieron los comentarios de `participant.service.ts` (`bulkUpdateStatus`) para reflejar el umbral configurable en vez de "50% mínimo".
4. **Doc existente sobre roles** no detallaba el mapa de permisos por canal; este documento lo establece (lectura abierta + mutación solo ADMIN). Sin cambios de permisos: solo se documentó el mapa existente.
5. **No hay gestión de fotos/multimedia** en todo el código; el producto es 100% gestión comercial. **Alineado** en `README.md` (nota sobre alcance), `LOGICA_DE_NEGOCIO.md` (regla R5, sección 5.4 y 7.1) y este documento.

**Recomendaciones (estado actual — resueltas):**
- ✅ `README.md` actualizado con la regla configurable y los scripts reales.
- ✅ Comentario de `event.service.ts` corregido para decir "participantes entregados" en vez de "fotos".
- ✅ Umbral de entrega documentado como configuración del negocio (ya existente en `Setting`) en `README.md` y `LOGICA_DE_NEGOCIO.md`.