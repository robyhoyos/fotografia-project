// playwright.electron.config.js
// E2E contra la aplicación REAL: Playwright lanza Electron (main process) con
// Prisma conectado a una base de datos SQLite de prueba (prisma/test-e2e.db),
// así que los tests atraviesan el verdadero flujo IPC → Service → Repository → SQLite.
// NO se usa el mock de `window.api` que sí usan los tests de tests/e2e.
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e-real',
  timeout: 90000,
  retries: 0,
  workers: 1,
  globalSetup: './tests/e2e-real/global-setup.js',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev:renderer',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60000,
  },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report-real' }]],
});