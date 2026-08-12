import type { ElectronAPI } from '../types/index'

if (!window.electronAPI) {
  throw new Error(
    'electronAPI is not available on window. This module must be used within an Electron renderer process.'
  )
}

export const api: ElectronAPI & { platform: NodeJS.Platform } = window.electronAPI
