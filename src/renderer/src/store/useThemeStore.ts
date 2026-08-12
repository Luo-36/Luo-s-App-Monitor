import { create } from 'zustand'
import { api } from '../api/bridge'

interface ThemeState {
  themeColor: string
  backgroundImage: string | null
  dimLevel: number

  setThemeColor: (color: string) => void
  setBackgroundImage: (url: string | null) => void
  setDimLevel: (level: number) => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  themeColor: 'taupe',
  backgroundImage: null,
  dimLevel: 0,

  setThemeColor: (color: string) => {
    set({ themeColor: color })
    // Persist to profile
    api.updateProfile({ theme_color: color }).catch(console.error)
  },

  setBackgroundImage: (url: string | null) => {
    set({ backgroundImage: url })
    // Persist the path; the url is used in-memory for display
  },

  setDimLevel: (level: number) => {
    const clamped = Math.max(0, Math.min(1, level))
    set({ dimLevel: clamped })
    api.updateProfile({ background_dim: clamped }).catch(console.error)
  },
}))
