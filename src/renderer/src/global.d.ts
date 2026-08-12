/// <reference types="vite/client" />

interface Window {
  electronAPI: import('./types/index').ElectronAPI
  platform: string
}
