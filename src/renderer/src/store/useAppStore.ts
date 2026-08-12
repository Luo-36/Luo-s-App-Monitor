import { create } from 'zustand'

interface AppState {
  sidebarCollapsed: boolean
  isVisible: boolean
  toggleSidebar: () => void
  setVisibility: (visible: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  isVisible: true,

  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  setVisibility: (visible: boolean) => set({ isVisible: visible }),
}))
