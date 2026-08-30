// tests/e2e-real/global-setup.js
// Corre una vez antes de la suite "real":
// 1. Regenera el cliente Prisma (para que respete `env("DATABASE_URL")`).
// 2. Compila Main + Preload a dist/ (Playwright lanzará Electron desde ahí).
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const ESBUILD = path.join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild');

module.exports = async function globalSetup() {
  console.log('[e2e-real] Generating Prisma client...');
  execFileSync('node', [PRISMA_CLI, 'generate'], { cwd: ROOT, stdio: 'pipe' });

  console.log('[e2e-real] Building main process...');
  execFileSync('node', [TSC, '-p', 'tsconfig.main.json'], { cwd: ROOT, stdio: 'pipe' });

  console.log('[e2e-real] Building preload...');
  execFileSync('node', [ESBUILD, 'src/preload/index.ts', '--bundle', '--platform=node', '--external:electron', '--format=cjs', '--outfile=dist/preload/src/preload/index.js'], { cwd: ROOT, stdio: 'pipe' });
};