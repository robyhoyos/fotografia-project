// tests/e2e-real/fixture.js
// Fixture `realApp` para los tests que corren contra la aplicación real.
// - Crea una BD de prueba aislada (prisma/test-e2e.db) y aplica las migraciones.
// - Lanza Electron con DATABASE_URL apuntando a esa BD.
// - Devuelve { app, page } sobre la ventana principal ya cargada.
// Cada test parte de una BD limpia (reset antes de lanzar Electron).
const { test: base } = require('@playwright/test');
const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const TEST_DB = path.join(ROOT, 'prisma', 'test-e2e.db');
const TEST_DB_URL = 'file:' + TEST_DB.split(path.sep).join('/');

function resetTestDb() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const file = TEST_DB + suffix;
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  execFileSync('node', [PRISMA_CLI, 'migrate', 'deploy'], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
    stdio: 'pipe',
  });
}

async function launchApp() {
  return electron.launch({
    args: ['.'],
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: TEST_DB_URL, PRISMA_HIDE_UPDATE_MESSAGE: 'true' },
  });
}

// El Main process abre DevTools en modo "detach", así que la PRIMERA ventana
// suele ser la de DevTools. Buscamos la ventana principal (la que carga el renderer).
async function mainWindow(app) {
  const BASE = 'http://localhost:5173';
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const win = app.windows().find((w) => w.url().startsWith(BASE));
    if (win) return win;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('No se encontró la ventana principal (localhost:5173)');
}

const test = base.extend({
  realApp: async ({}, use) => {
    resetTestDb();
    const app = await launchApp();
    const page = await mainWindow(app);
    await page.waitForLoadState('domcontentloaded');
    // Primer arranque: la BD está limpia, así que la app pide crear el
    // administrador inicial. Esperamos a que desaparezca el splash de carga
    // y completamos el setup de una sola vez.
    const setupHeading = page.getByRole('heading', { name: 'Crea tu administrador' });
    await setupHeading.waitFor({ timeout: 30000 });
    if (await setupHeading.isVisible().catch(() => false)) {
      await page.getByPlaceholder('Ej: Andrés').fill('Admin E2E');
      await page.getByPlaceholder('nombre de usuario').fill('admin');
      await page.getByPlaceholder('••••••••').fill('e2e-password');
      await page.getByPlaceholder('repite la contraseña').fill('e2e-password');
      await page.getByRole('button', { name: 'Crear cuenta de administrador' }).click();
    }
    await page.getByRole('heading', { name: 'Gestión de Eventos' }).waitFor({ timeout: 30000 });
    await use({ app, page });
    await app.close();
  },
});

module.exports = { test, expect: base.expect, TEST_DB_URL, ROOT };