import { app } from 'electron'
import path from 'path'
import { ActiveWindowMonitor } from './windows-utils'

/**
 * One-shot foreground-window capture: watches the active window and fires a
 * callback once the SAME process has stayed focused for `thresholdMs`.
 * Used by the "auto-add program" feature.
 */
export class WindowCapture {
  private monitor: ActiveWindowMonitor | null = null
  private currentProcess = ''
  private focusStartTime = 0
  private onDetected: ((processName: string) => void) | null = null
  private selfProcessName = ''

  start(onDetected: (processName: string) => void, thresholdMs = 3000): void {
    this.onDetected = onDetected
    this.currentProcess = ''
    this.focusStartTime = 0

    try {
      this.selfProcessName = path.basename(app.getPath('exe')).toLowerCase()
    } catch {
      this.selfProcessName = 'electron.exe'
    }

    this.monitor = new ActiveWindowMonitor()
    this.monitor.onProcessChange((name) => this.handleProcess(name, thresholdMs))
    this.monitor.onFailed(() => this.stop())
    this.monitor.start()
  }

  stop(): void {
    if (this.monitor) {
      this.monitor.stop()
      this.monitor = null
    }
  }

  private handleProcess(name: string, thresholdMs: number): void {
    const lower = name.toLowerCase()
    // Ignore our own window (and empty / no foreground window)
    if (!lower || lower === this.selfProcessName) {
      this.currentProcess = ''
      return
    }

    const now = Date.now()
    if (lower === this.currentProcess) {
      // Same process still focused — check threshold
      if (now - this.focusStartTime >= thresholdMs) {
        const detected = this.currentProcess
        this.onDetected?.(detected)
        this.stop()
      }
    } else {
      // New foreground process
      this.currentProcess = lower
      this.focusStartTime = now
    }
  }
}
