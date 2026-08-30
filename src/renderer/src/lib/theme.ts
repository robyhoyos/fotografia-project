// src/renderer/src/lib/theme.ts
// Tokens semánticos de tema (clases Tailwind) para mantener consistencia
// entre modo oscuro y claro. Centraliza los colores de la UI.
//
// Uso: const t = useThemeTokens()  →  className={`${t.cardBg} ${t.border}`}

import { useUIStore } from '../stores/ui.store'

export type ThemeMode = 'dark' | 'light'

export interface ThemeTokens {
  // Página
  pageBg: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textFaint: string
  accent: string
  okText: string
  dangerText: string
  infoText: string

  // Superficies
  cardBg: string
  tableBg: string
  surfaceAlt: string
  border: string
  borderStrong: string
  divider: string
  rowHover: string

  // Drawers / Overlays (paneles laterales y modales)
  drawerBg: string
  drawerHeader: string
  overlay: string

  // Tablas
  tableHeadBg: string
  tableHeadText: string

  // Entradas
  input: string
  checkbox: string

  // Botones / iconos
  btnGhost: string
  iconBtn: string
  iconBtnDanger: string

  // Badges de estado
  badgeAmber: string
  badgeBlue: string
  badgeEmerald: string
  badgeRed: string
  badgeGray: string
  badgePurple: string
  badgeOrange: string

  // Mensajes (banners)
  successBanner: string

  // Barras de progreso
  progressTrack: string

  // Acciones de contexto (barras flotantes)
  floatingBar: string

  // Sidebar (se mantiene oscura en ambos temas)
  sidebarBg: string
}

const DARK: ThemeTokens = {
  pageBg: 'bg-[#121212]',
  textPrimary: 'text-white',
  textSecondary: 'text-gray-300',
  textMuted: 'text-gray-500',
  textFaint: 'text-gray-600',
  accent: 'text-amber-400',
  okText: 'text-emerald-400',
  dangerText: 'text-red-400',
  infoText: 'text-blue-400',

  cardBg: 'bg-gray-900/50',
  tableBg: 'bg-transparent',
  surfaceAlt: 'bg-gray-800/30',
  border: 'border-gray-800/50',
  borderStrong: 'border-gray-700',
  divider: 'divide-gray-800/30',
  rowHover: 'hover:bg-gray-800/30',

  drawerBg: 'bg-gray-900',
  drawerHeader: 'border-b border-gray-800/50',
  overlay: 'bg-black/60',

  tableHeadBg: 'bg-gray-900/50',
  tableHeadText: 'text-gray-400',

  input:
    'border-gray-800 bg-gray-900/50 text-white placeholder-gray-500 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500',
  checkbox: 'border-gray-600 bg-gray-800 text-amber-500 focus:ring-amber-500 focus:ring-offset-0',

  btnGhost: 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white',
  iconBtn: 'text-gray-400 hover:bg-gray-700 hover:text-white',
  iconBtnDanger: 'hover:bg-red-900/50 hover:text-red-400',

  badgeAmber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  badgeBlue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  badgeEmerald: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  badgeRed: 'bg-red-500/20 text-red-400 border-red-500/30',
  badgeGray: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  badgePurple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  badgeOrange: 'bg-orange-500/20 text-orange-400',

  successBanner: 'bg-emerald-900/30 text-emerald-400',

  progressTrack: 'bg-gray-800',

  floatingBar: 'border-gray-700/50 bg-gray-900/95',

  sidebarBg: 'bg-[#0a0a0a]',
}

const LIGHT: ThemeTokens = {
  pageBg: 'bg-[#F6F7F9]',
  textPrimary: 'text-gray-900',
  textSecondary: 'text-gray-600',
  textMuted: 'text-gray-500',
  textFaint: 'text-gray-400',
  accent: 'text-amber-600',
  okText: 'text-emerald-700',
  dangerText: 'text-red-700',
  infoText: 'text-blue-700',

  cardBg: 'bg-white',
  tableBg: 'bg-white',
  surfaceAlt: 'bg-gray-50',
  border: 'border-gray-200',
  borderStrong: 'border-gray-300',
  divider: 'divide-gray-100',
  rowHover: 'hover:bg-gray-50',

  drawerBg: 'bg-white',
  drawerHeader: 'border-b border-gray-200',
  overlay: 'bg-black/40',

  tableHeadBg: 'bg-[#1F2937]',
  tableHeadText: 'text-gray-200',

  input:
    'border-gray-300 bg-white text-gray-900 placeholder-gray-400 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500',
  checkbox: 'border-gray-400 bg-white text-amber-500 focus:ring-amber-500 focus:ring-offset-0',

  btnGhost: 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100 hover:text-gray-900',
  iconBtn: 'text-gray-500 hover:bg-gray-200 hover:text-gray-900',
  iconBtnDanger: 'hover:bg-red-100 hover:text-red-600',

  badgeAmber: 'bg-amber-100 text-amber-800 border-amber-200',
  badgeBlue: 'bg-blue-100 text-blue-700 border-blue-200',
  badgeEmerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  badgeRed: 'bg-red-100 text-red-700 border-red-200',
  badgeGray: 'bg-gray-100 text-gray-600 border-gray-200',
  badgePurple: 'bg-purple-100 text-purple-700 border-purple-200',
  badgeOrange: 'bg-orange-100 text-orange-700',

  successBanner: 'bg-emerald-100 text-emerald-700',

  progressTrack: 'bg-gray-200',

  floatingBar: 'border-gray-300 bg-white/95',

  sidebarBg: 'bg-[#0a0a0a]',
}

/**
 * @hook useThemeTokens
 * @description Retorna los tokens de clases Tailwind según el tema activo.
 * Mantiene un solo punto de verdad para los colores de la UI.
 */
export function useThemeTokens(): ThemeTokens {
  const theme = useUIStore((s) => s.theme)
  return theme === 'light' ? LIGHT : DARK
}