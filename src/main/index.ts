// src/main/index.ts
// Entry point del Electron Main Process.
// Inicializa la app, crea la ventana, registra handlers IPC y maneja el lifecycle.

import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { execFile, execSync } from 'child_process'
import { isPackaged } from './database/paths'
// El bootstrap DEBE importarse antes de ./database/prisma para que DATABASE_URL
// esté definido (ruta escribible en producción) cuando se construya PrismaClient.
import './database/bootstrap'
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
import { UserRepository } from './repositories/user.repository'
import { AuthService } from './services/auth.service'
import { registerAuthHandlers } from './handlers/auth.handler'
import { setAuthService } from './auth/permissions'

// ─── Singleton de ventana ────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null

/**
 * @function loadDevRenderer
 * @description Carga el renderer en desarrollo con reintentos.
 *
 * Electron arranca con `npm run dev` EN PARALELO con Vite, por lo que
 * a menudo hace el `loadURL` antes de que el servidor esté listo en
 * localhost:5173 (ERR_CONNECTION_REFUSED). Sin reintento, la ventana
 * queda en blanco. Este helper reintenta hasta que Vite responda.
 */
function loadDevRenderer(win: BrowserWindow): void {
  const DEV_URL = 'http://localhost:5173'
  const MAX_ATTEMPTS = 40 // ~20s (500ms por intento)

  let attempts = 0
  const attempt = () => {
    if (win.isDestroyed() || attempts >= MAX_ATTEMPTS) return
    attempts += 1
    win
      .loadURL(DEV_URL)
      .then(() => {
        // Si por algún motivo se perdió 'ready-to-show' en los reintentos,
        // garantizamos que la ventana quede visible tras la carga.
        win.show()
      })
      .catch(() => {
        // ERROR_CONNECTION_REFUSED: el servidor aún no está listo.
        setTimeout(attempt, 500)
      })
  }
  attempt()
}

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
    loadDevRenderer(mainWindow)
    // Abrir DevTools en ventana separada (no compite con el drawer de la app)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(
      path.join(__dirname, '../../../renderer/index.html')
    )
  }

  // ─── DevTools solo en desarrollo ─────────────────────────────
  // En dev, F12 / Ctrl+Shift+I abren las herramientas. En producción
  // se bloquean para que el usuario final no pueda abrir la consola.
  if (!app.isPackaged) {
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
  }

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

  // ─── Autenticación: la sesión se comparte con la guardia de permisos ──
  const authService = new AuthService(new UserRepository())
  setAuthService(authService)

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
  registerAuthHandlers()
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

  console.info('[Main] Services y handlers IPC inicializados')
}

// ─── Lifecycle de la aplicación ──────────────────────────────────────

app.whenReady().then(async () => {
  // Conectar a Prisma/SQLite
  await prisma.$connect()
  console.info('[Main] Conectado a SQLite via Prisma')

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
  console.info('[Main] Desconectado de SQLite')

  if (process.platform !== 'darwin') {
    app.quit()
    // En desarrollo, al cerrar la app, detener también el proceso dev
    // (concurrently -> vite) para liberar el puerto y no dejar procesos colgados.
    teardownDevProcess()
  }
})

/**
 * @function teardownDevProcess
 * @description Solo en desarrollo: detiene el proceso `concurrently` que lanzó
 * el pipeline dev (npm run dev → concurrently → vite / electron). Al bajar su
 * árbol con taskkill /T, `vite` termina y se libera el puerto del dev server,
 * sin matar la terminal del usuario. En producción no hace nada.
 */
function teardownDevProcess(): void {
  if (isPackaged()) return

  // Subir la cadena de procesos y detectar el `concurrently` (node dev) para
  // detenerlo junto a todo su árbol (vite incluido).
  let root = process.ppid
  let guard = 0
  while (root && root > 0 && root !== process.pid && guard < 12) {
    try {
      const commandLine = getCommandLine(root)
      // El pipeline `concurrently` se identifica por contener su binario en la
      // línea de comandos; es el punto de ramificación hacia vite/electron.
      if (/concurrently/.test(commandLine)) {
        break
      }
    } catch {
      /* ancestro ya terminado */
    }
    const parent = getParentPid(root)
    if (parent && parent > 0 && parent !== root) {
      root = parent
    } else {
      break
    }
    guard += 1
  }

  if (root && root > 0) {
    if (process.platform === 'win32') {
      execFile('taskkill', ['/PID', String(root), '/T', '/F'], (err) => {
        if (err) {
          console.warn('[Main] No se pudo detener el proceso dev:', err.message)
        }
      })
    } else {
      // POSIX: terminar el grupo de procesos.
      try {
        process.kill(-root, 'SIGTERM')
      } catch {
        try {
          process.kill(root, 'SIGTERM')
        } catch {
          /* proceso ya cerrado */
        }
      }
    }
  }
}

/**
 * @function getParentPid
 * @description Devuelve el PID padre del proceso indicado (Windows vía PowerShell).
 */
function getParentPid(pid: number): number {
  try {
    const result = execSync(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').ParentProcessId"`,
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const n = parseInt(result.trim(), 10)
    return Number.isFinite(n) ? n : 0
  } catch {
    return 0
  }
}

/**
 * @function getCommandLine
 * @description Devuelve la línea de comandos de un proceso (Windows vía PowerShell).
 */
function getCommandLine(pid: number): string {
  try {
    const result = execSync(
      `powershell -NoProfile -Command "(Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}').CommandLine"`,
      { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] },
    )
    return result.trim()
  } catch {
    return ''
  }
}

// Manejo de errores no capturados
process.on('uncaughtException', async (error) => {
  console.error('[Main] Excepción no capturada:', error)
  await prisma.$disconnect()
  app.quit()
})
