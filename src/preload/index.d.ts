// src/preload/index.d.ts
// Declaración de tipos para window.api.
// Permite al Renderer acceder a la API tipada sin errores de TypeScript.

import type { ElectronAPI } from './index'

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
