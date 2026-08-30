// src/main/index.ts
// Entry point del Electron Main Process.
// Inicializa la app, crea la ventana, registra handlers IPC y maneja el lifecycle.

import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import prisma from './database/prisma'
import { EventRepository } from './repositories/event.repository'
import { ParticipantRepository } from './repositories/participant.repository'
import { EventService } from './services/event.service'
import { ParticipantService } from './services/participant.service'
import { registerEventHandlers } from './handlers/event.handler'
import { registerParticipantHandlers } from './handlers/participant.handler'
import { registerDatabaseHandlers } from './handlers/database.handler'
import { PaymentRepository } from './repositories/payment.repository'
import { PaymentService } from './services/payment.service'
import { registerPaymentHandlers } from './handlers/payment.handler'
import { registerPdfHandlers } from './handlers/pdf.handler'
import { registerExportHandlers } from './handlers/export.handler'
import { SettingsRepository } from './repositories/settings.repository'
import { SettingsService } from './services/settings.service'
import { registerSettingsHandlers } from './handlers/settings.handler'
import { StatsRepository } from './repositories/stats.repository'
import { StatsService } from './services/stats.service'
import { registerStatsHandlers } from './handlers/stats.handler'
import { IncidentRepository } from './repositories/incident.repository'
import { IncidentService } from './services/incident.service'
import { registerIncidentHandlers } from './handlers/incident.handler'
import { registerDialogHandlers } from './handlers/dialog.handler'

// ─── Singleton de ventana ────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null

/**
 * @function createWindow
 * @description Crea la ventana principal de Electron.
 *
 * @security
 * - nodeIntegration: false → El Renderer NO tiene acceso a Node.js APIs
 * - contextIsolation: true → El contexto del Renderer está aislado
 * - webSecurity: true → Habilita same-origin policy
 * - preload script → Único puente de comunicación con el Main process
 */
function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'Gestión Fotográfica',
    webPreferences: {
      preload: path.join(__dirname, '../../../preload/src/preload/index.js'),
      nodeIntegration: false,       // SEGURIDAD: Sin acceso a Node en Renderer
      contextIsolation: true,       // SEGURIDAD: Aislamiento de contexto
      webSecurity: true,
    },
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#121212',
    show: false,
  })

  // En desarrollo carga localhost, en producción carga el archivo HTML
  // app.isPackaged es true solo cuando la app está empaquetada con electron-builder
  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    // Abrir DevTools en ventana separada (no compite con el drawer de la app)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../../../renderer/index.html')
    )
  }

  // ─── DevTools siempre accesible con F12 / Ctrl+Shift+I ─────────
  // Evita el problema de que el atajo se pierda si la ventana pierde foco.
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type !== 'keyDown') return
    const isF12 = input.key === 'F12'
    const isCtrlShiftI =
      input.control && input.shift && input.key.toLowerCase() === 'i'
    if (isF12 || isCtrlShiftI) {
      mainWindow?.webContents.toggleDevTools()
      _event.preventDefault()
    }
  })

  // Mostrar ventana cuando esté lista (evita flash blanco)
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  // Abrir enlaces externos en el navegador del sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

/**
 * @function initializeServices
 * @description Inicializa el patrón de dependencias: Repository → Service → Handler.
 *
 * Flujo de inyección de dependencias:
 * ```text
 * prisma (database)
 *   ↓
 * EventRepository(prisma) / ParticipantRepository(prisma)
 *   ↓
 * EventService(eventRepo) / ParticipantService(participantRepo)
 *   ↓
 * registerEventHandlers(eventService)
 * registerParticipantHandlers(participantService)
 * ```
 */
async function initializeServices(): Promise<void> {
  // Repositories (acceso a datos)
  const eventRepo = new EventRepository(prisma)
  const participantRepo = new ParticipantRepository(prisma)
  const paymentRepo = new PaymentRepository(prisma)

  // ─── Configuración (se inyecta en servicios que dependen de settings) ──
  const settingsRepository = new SettingsRepository()
  const settingsService = new SettingsService(settingsRepository)
  await settingsService.initializeDefaults()

  // Services (lógica de negocio)
  const eventService = new EventService(eventRepo)
  const participantService = new ParticipantService(participantRepo, eventRepo, settingsRepository)
  const paymentService = new PaymentService(paymentRepo)
  const statsService = new StatsService(new StatsRepository())
  const incidentService = new IncidentService(new IncidentRepository(prisma), prisma)

  // Handlers IPC (puente entre Renderer y Services)
  registerEventHandlers(eventService)
  registerParticipantHandlers(participantService)
  registerDatabaseHandlers()
  registerPaymentHandlers(paymentService)
  registerPdfHandlers()
  registerExportHandlers(settingsService)
  registerSettingsHandlers(settingsService)
  registerStatsHandlers(statsService)
  registerIncidentHandlers(incidentService)
  registerDialogHandlers()

  console.log('[Main] Services y handlers IPC inicializados')
}

// ─── Lifecycle de la aplicación ──────────────────────────────────────

app.whenReady().then(async () => {
  // Conectar a Prisma/SQLite
  await prisma.$connect()
  console.log('[Main] Conectado a SQLite via Prisma')

  // Inicializar servicios y handlers IPC
  await initializeServices()

  // Crear ventana principal
  createWindow()

  // macOS: re-crear ventana si se hace click en el dock
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Cerrar limpiamente al cerrar todas las ventanas
app.on('window-all-closed', async () => {
  await prisma.$disconnect()
  console.log('[Main] Desconectado de SQLite')

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Manejo de errores no capturados
process.on('uncaughtException', async (error) => {
  console.error('[Main] Excepción no capturada:', error)
  await prisma.$disconnect()
  app.quit()
})
