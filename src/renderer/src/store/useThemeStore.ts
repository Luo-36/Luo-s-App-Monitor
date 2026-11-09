import { create } from 'zustand'

interface ThemeState {
  themeColor: string
  backgroundImage: string | null
  dimLevel: number

  setThemeColor: (color: string) => void
  setBackgroundImage: (url: string | null) => void
  setDimLevel: (level: number) => void
}

/**
 * Pure in-memory appearance state. Persistence happens when the settings page
 * is saved, which lets the UI preview theme / dim / scale changes live.
 */
export const useThemeStore = create<ThemeState>((set) => ({
  themeColor: 'taupe',
  backgroundImage: null,
  dimLevel: 0,

  setThemeColor: (color: string) => set({ themeColor: color }),

  setBackgroundImage: (url: string | null) => set({ backgroundImage: url }),

  setDimLevel: (level: number) => {
    const clamped = Math.max(0, Math.min(1, level))
    set({ dimLevel: clamped })
  }
}))
