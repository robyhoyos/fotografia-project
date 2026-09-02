// src/renderer/src/components/settings/UsersSection.tsx
// Sección "Usuarios y roles" para la página de Configuración (solo ADMIN).
// Permite crear ayudantes (solo lectura) o administradores, listar los
// existentes y activar/desactivar el acceso de cada uno.

import React, { useState } from 'react'
import { useThemeTokens } from '../../lib/theme'
import { useToast } from '../../hooks/useToast'
import { useUsers, useCreateUser, useToggleUser } from '../../hooks/useUsers'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import type { UserRecord, AppRole } from '../../../../../shared/types/ipc'

const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Administrador',
  AYUDANTE: 'Ayudante',
}

export function UsersSection() {
  const t = useThemeTokens()
  const { success, error: toastError } = useToast()

  const { data: users, isLoading } = useUsers()
  const createUser = useCreateUser()
  const toggleUser = useToggleUser()

  const [showForm, setShowForm] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [role, setRole] = useState<AppRole>('AYUDANTE')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [toggleTarget, setToggleTarget] = useState<UserRecord | null>(null)

  const resetForm = () => {
    setUsername('')
    setPassword('')
    setConfirm('')
    setDisplayName('')
    setRole('AYUDANTE')
    setFieldError(null)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldError(null)

    if (!username.trim()) return setFieldError('Escribe un nombre de usuario')
    if (password.length < 6)
      return setFieldError('La contraseña debe tener al menos 6 caracteres')
    if (password !== confirm)
      return setFieldError('Las contraseñas no coinciden')

    try {
      const created = await createUser.mutateAsync({
        username: username.trim(),
        password,
        role,
        displayName: displayName.trim() || null,
      })
      success(
        'Usuario creado',
        `${created.username} (${ROLE_LABELS[created.role]}) ya puede iniciar sesión`
      )
      resetForm()
      setShowForm(false)
    } catch (err) {
      setFieldError((err as Error).message)
    }
  }

  const handleToggle = async () => {
    if (!toggleTarget) return
    try {
      await toggleUser.mutateAsync({
        userId: toggleTarget.id,
        isActive: !toggleTarget.isActive,
      })
      success(
        toggleTarget.isActive ? 'Acceso desactivado' : 'Acceso activado',
        `${toggleTarget.username} ${toggleTarget.isActive ? 'ya no' : 'ya'} puede iniciar sesión`
      )
      setToggleTarget(null)
    } catch (err) {
      toastError('Error al cambiar el estado', (err as Error).message)
      setToggleTarget(null)
    }
  }

  const inputBase =
    'mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:border-emerald-500 focus:ring-emerald-500 ' +
    t.input

  return (
    <section className={`rounded-xl border p-5 ${t.border} ${t.cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Usuarios y roles</h2>
          <p className={`text-sm mt-0.5 ${t.textMuted}`}>
            Los ayudantes solo pueden ver (no modificar). Los administradores tienen acceso total.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
          >
            + Nuevo usuario
          </button>
        )}
      </div>

      {/* ─── Formulario de creación ─────────────────────────── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className={`space-y-4 rounded-lg border p-4 mb-4 ${t.border} ${t.surfaceAlt}`}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                Nombre visible <span className={t.textFaint}>(opcional)</span>
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ej: Juan Ayudante"
                className={inputBase}
              />
            </div>
            <div>
              <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                Usuario *
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nombre de usuario"
                className={inputBase}
              />
            </div>
            <div>
              <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                Contraseña *
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
                className={inputBase}
              />
            </div>
            <div>
              <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                Confirmar contraseña *
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="repite la contraseña"
                className={inputBase}
              />
            </div>
          </div>

          <div>
            <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
              Rol *
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('AYUDANTE')}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  role === 'AYUDANTE'
                    ? `border-emerald-500/70 bg-emerald-500/15 ${t.okText}`
                    : t.btnGhost
                }`}
              >
                Ayudante · solo lectura
              </button>
              <button
                type="button"
                onClick={() => setRole('ADMIN')}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  role === 'ADMIN'
                    ? `border-emerald-500/70 bg-emerald-500/15 ${t.okText}`
                    : t.btnGhost
                }`}
              >
                Administrador · acceso total
              </button>
            </div>
          </div>

          {fieldError && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5">
              <p className={`text-xs ${t.dangerText}`}>{fieldError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${t.btnGhost}`}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createUser.isPending}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {createUser.isPending ? 'Creando...' : 'Crear usuario'}
            </button>
          </div>
        </form>
      )}

      {/* ─── Lista de usuarios ──────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-6 w-6 rounded-full border-b-2 border-emerald-500" />
        </div>
      ) : !users || users.length === 0 ? (
        <p className={`text-sm py-4 text-center ${t.textFaint}`}>
          Aún no hay usuarios. Crea el primero con el botón de arriba.
        </p>
      ) : (
        <ul className={`divide-y ${t.divider}`}>
          {users.map((user) => (
            <li key={user.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    user.role === 'ADMIN'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : 'bg-gray-500/15 text-gray-400'
                  }`}
                >
                  {(user.displayName || user.username).slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${t.textPrimary}`}>
                    {user.displayName || user.username}
                    {!user.isActive && (
                      <span className={`ml-2 text-xs ${t.textFaint}`}>(desactivado)</span>
                    )}
                  </p>
                  <p className={`text-xs truncate ${t.textMuted}`}>
                    @{user.username} · {ROLE_LABELS[user.role]}
                  </p>
                </div>
              </div>
              {user.role === 'ADMIN' && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${t.badgeEmerald}`}>
                  Admin
                </span>
              )}
              <button
                onClick={() => setToggleTarget(user)}
                className={`ml-3 shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                  user.isActive ? t.btnGhost : t.okText
                }`}
              >
                {user.isActive ? 'Desactivar' : 'Activar'}
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ─── Confirmación de activar/desactivar ─────────────── */}
      <ConfirmDialog
        isOpen={!!toggleTarget}
        title={toggleTarget?.isActive ? '¿Desactivar acceso?' : '¿Activar acceso?'}
        message={
          toggleTarget
            ? `El usuario "${toggleTarget.displayName || toggleTarget.username}" ${
                toggleTarget.isActive
                  ? 'ya no podrá iniciar sesión.'
                  : 'volverá a poder iniciar sesión.'
              }`
            : ''
        }
        confirmLabel={toggleTarget?.isActive ? 'Desactivar' : 'Activar'}
        variant="danger"
        onConfirm={handleToggle}
        onCancel={() => setToggleTarget(null)}
      />
    </section>
  )
}
