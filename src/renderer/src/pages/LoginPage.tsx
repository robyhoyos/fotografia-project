// src/renderer/src/pages/LoginPage.tsx
// Pantalla de acceso a la aplicación de gestión fotográfica.
//
// Dos modos según el estado de la app:
//  - "setup": primer arranque → crear el administrador inicial.
//  - "login": usuarios existentes → iniciar sesión.
//
// Dirección de diseño (frontend-design):
//  Layout editorial dividido: un panel de marca oscuro con tipografía serif
//  de carácter e índices fotográficos laterales, junto a un panel de acceso
//  limpio. Acento esmeralda coherente con el resto de la app (--accent).

import React, { useRef, useState } from 'react'
import { useAuthStore } from '../stores/auth.store'
import { useToast } from '../hooks/useToast'

interface LoginPageProps {
  mode: 'setup' | 'login'
}

export function LoginPage({ mode }: LoginPageProps) {
  const login = useAuthStore((s) => s.login)
  const { success } = useToast()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  const isSetup = mode === 'setup'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)

    if (isSetup) {
      if (!username.trim()) return setFieldError('Escribe un nombre de usuario')
      if (password.length < 6)
        return setFieldError('La contraseña debe tener al menos 6 caracteres')
      if (password !== confirm)
        return setFieldError('Las contraseñas no coinciden')

      setLoading(true)
      try {
        const res = await window.api.auth.setupAdmin({
          username,
          password,
          displayName: displayName || null,
        })
        if (res.success && res.data) {
          useAuthStore.getState().setUser(res.data)
          useAuthStore.setState({ status: 'authenticated' })
          success('Bienvenido', 'Administrador configurado correctamente')
        } else {
          setFieldError(res.error || 'No se pudo configurar el administrador')
        }
      } catch (err) {
        setFieldError((err as Error).message)
      } finally {
        setLoading(false)
      }
      return
    }

    // Modo login
    if (!username.trim()) return setFieldError('Escribe tu nombre de usuario')
    if (!password) return setFieldError('Escribe tu contraseña')

    setLoading(true)
    try {
      await login(username, password)
      success('Bienvenido', 'Sesión iniciada')
    } catch (err) {
      setFieldError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const inputBase =
    'w-full rounded-lg border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder-white/30 transition-all focus:border-emerald-400/70 focus:outline-none focus:ring-1 focus:ring-emerald-400/50'

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#0b0e0d] text-white antialiased">
      {/* ─── Panel de marca (izquierda) ─────────────────────────── */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#0b0e0d] p-10 md:flex">
        {/* Retícula decorativa */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(34,197,94,0.35) 1px, transparent 1px), linear-gradient(90deg, rgba(34,197,94,0.35) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
          }}
        />

        {/* Halos esmeralda sutiles */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full blur-[100px]"
          style={{ background: 'rgba(34,197,94,0.16)' }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full blur-[120px]"
          style={{ background: 'rgba(34,197,94,0.10)' }}
        />

        {/* Marca */}
        <div className="relative animate-slide-in-up" style={{ animationDelay: '0.05s' }}>
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
            </span>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-400">
              Portfolio Studio
            </p>
          </div>
        </div>

        {/* Titular editorial */}
        <div className="relative">
          <p className="animate-slide-in-up text-[11px] font-medium uppercase tracking-[0.25em] text-white/40" style={{ animationDelay: '0.12s' }}>
            Gestión de eventos fotográficos
          </p>
          <h1
            className="animate-slide-in-up mt-4 font-display text-6xl font-bold leading-[0.95] tracking-tight"
            style={{ animationDelay: '0.18s' }}
          >
            Cada sesión,
            <br />
            <span className="text-emerald-400">cada entrega,</span>
            <br />
            bajo control.
          </h1>
          <p className="animate-slide-in-up mt-6 max-w-md text-sm leading-relaxed text-white/50" style={{ animationDelay: '0.24s' }}>
            Organiza tus eventos, controla entregas y cobros, y lleva la base de
            clientes de tu estudio en un solo lugar.
          </p>
        </div>

        {/* Indicadores / pie */}
        <div className="relative flex items-center justify-between animate-slide-in-up text-[10px] uppercase tracking-widest text-white/30" style={{ animationDelay: '0.3s' }}>
          <span>Eventos — Participantes — Cobros</span>
          <span className="flex items-center gap-3">
            <span className="h-px w-10 bg-emerald-400/40" />
            Estudio Fotográfico
          </span>
        </div>
      </div>

      {/* ─── Panel de acceso (derecha) ─────────────────────────── */}
      <div className="relative flex flex-1 items-center justify-center bg-[#0f1412] px-6 animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
        {/* Detalle superior: número de página */}
        <span className="absolute right-8 top-6 text-[10px] uppercase tracking-[0.3em] text-white/25">
          {isSetup ? 'Configuración inicial' : 'Acceso seguro'}
        </span>

        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 md:hidden">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
            <p className="font-display text-lg font-bold tracking-tight">Portfolio Studio</p>
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-emerald-400">
            {isSetup ? 'Primer paso' : 'Bienvenido de nuevo'}
          </p>
          <h2 className="mt-3 font-display text-4xl font-bold tracking-tight">
            {isSetup ? 'Crea tu administrador' : 'Acceso profesional'}
          </h2>
          <p className="mt-2 text-sm text-white/50">
            {isSetup
              ? 'Esta cuenta tendrá control total sobre la aplicación.'
              : 'Inicia sesión para gestionar tu estudio fotográfico.'}
          </p>

          {isSetup && (
            <div className="mt-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] leading-relaxed text-white/55">
              El administrador podrá crear eventos, participantes, gestionar pagos,
              exportaciones, respaldos y usuarios adicionales con rol de ayudante.
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {isSetup && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Nombre visible <span className="text-white/25">(opcional)</span>
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ej: Andrés"
                  className={inputBase}
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nombre de usuario"
                autoComplete="username"
                autoFocus
                className={inputBase}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-white/60">
                Contraseña
              </label>
              <div className="relative">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={isSetup ? 'new-password' : 'current-password'}
                  className={`${inputBase} pr-11`}
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-white/35 transition-colors hover:text-white/70"
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {isSetup && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-white/60">
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="repite la contraseña"
                    autoComplete="new-password"
                    className={`${inputBase} pr-11`}
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-white/35 transition-colors hover:text-white/70"
                    title={showConfirm ? 'Ocultar' : 'Mostrar'}
                  >
                    {showConfirm ? (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            )}

            {fieldError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 animate-slide-in-up">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-xs text-red-300">{fieldError}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full overflow-hidden rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-950 transition-all hover:bg-emerald-400 disabled:opacity-60"
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black/80" />
                    {isSetup ? 'Configurando...' : 'Ingresando...'}
                  </>
                ) : isSetup ? (
                  'Crear cuenta de administrador'
                ) : (
                  'Iniciar sesión'
                )}
              </span>
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3 text-[10px] uppercase tracking-widest text-white/25">
            <span className="h-px flex-1 bg-white/10" />
            Acceso restringido
            <span className="h-px flex-1 bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  )
}
