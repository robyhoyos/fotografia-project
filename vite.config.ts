import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  // base relativo: en producción la app se carga con file:// vía loadFile y
  // rutas absolutas (/assets/...) apuntarían a la raíz del disco, no a la carpeta
  // de la app => "pantalla negra". Con './' se generan rutas relativas válidas.
  base: './',
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer/src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
})
