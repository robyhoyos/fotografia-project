// src/renderer/src/main.tsx
// Entry point del React Renderer.
// Inicializa React Query Provider y renderiza la app.

import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import './index.css'

/**
 * @description Configuración de TanStack Query.
 * - staleTime: 30s → No re-fetch si los datos tienen menos de 30s
 * - gcTime: 5min → Mantener en caché por 5 minutos
 * - refetchOnWindowFocus: true → Re-fetch al volver a la pestaña
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
