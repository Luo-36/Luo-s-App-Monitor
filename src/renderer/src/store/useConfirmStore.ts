import { create } from 'zustand'

export interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState {
  isOpen: boolean
  options: ConfirmOptions | null
  resolver: ((value: boolean) => void) | null
  ask: (options: ConfirmOptions) => Promise<boolean>
  respond: (value: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  isOpen: false,
  options: null,
  resolver: null,

  ask: (options) =>
    new Promise<boolean>((resolve) => {
      // Close any dialog already waiting so it can't hang forever.
      get().resolver?.(false)
      set({ isOpen: true, options, resolver: resolve })
    }),

  respond: (value) => {
    get().resolver?.(value)
    set({ isOpen: false, options: null, resolver: null })
  }
}))

/** Promise-based replacement for window.confirm. */
export const confirmDialog = (
  options: ConfirmOptions
): Promise<boolean> => useConfirmStore.getState().ask(options)
