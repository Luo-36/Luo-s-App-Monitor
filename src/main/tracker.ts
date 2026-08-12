import { BrowserWindow, app } from 'electron'
import path from 'path'
import { ActiveWindowMonitor, IntervalPoller, SimplePoller } from './windows-utils'
import {
  getPrograms,
  startSession,
  endSession,
  updateSessionDuration,
  getTodayUsage
} from './database'

interface ProcessCacheEntry {
  programId: number
  processName: string
}

interface TrackingState {
  programId: number | null
  sessionId: number | null
  startTime: Date | null
  tickCount: number
}

export class UsageTracker {
  private mainWindow: BrowserWindow
  private monitor: ActiveWindowMonitor
  private intervalPoller: IntervalPoller | null = null
  private monitorType: string = 'ActiveWindowMonitor'
  private processCache: Map<string, ProcessCacheEntry> = new Map()
  private state: TrackingState = {
    programId: null,
    sessionId: null,
    startTime: null,
    tickCount: 0
  }
  private isRunning: boolean = false
  private lastDetectedProcess: string = ''
  private selfProcessName: string = ''
  private periodicFlushTimer: NodeJS.Timeout | null = null
  private cacheRefreshTimer: NodeJS.Timeout | null = null
  private tickCallback: ((currentProgram: { programId: number; elapsedSeconds: number } | null) => void) | null = null
  private simplePoller: SimplePoller | null = null

  onTick(callback: (currentProgram: { programId: number; elapsedSeconds: number } | null) => void): void {
    this.tickCallback = callback
  }

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.monitor = new ActiveWindowMonitor()

    try {
      this.selfProcessName = path.basename(app.getPath('exe')).toLowerCase()
    } catch {
      this.selfProcessName = 'electron.exe'
    }

    this.monitor.onProcessChange((processName) =>
      this.handleProcessChange(processName)
    )

    this.monitor.onFailed(() => {
      this.monitor.stop()
      // Fall back to SimplePoller (pure PowerShell cmdlets, no C# compilation needed)
      this.startSimplePoller()
    })
  }

  start(): void {
    if (this.isRunning) return
    this.isRunning = true
    this.monitorType = 'ActiveWindowMonitor'

    this.updateProcessCache()

    // Primary: ActiveWindowMonitor (long-running PowerShell + C# compilation)
    // Uses GetForegroundWindow() Win32 API for accurate foreground window detection.
    // Requires .NET Framework (pre-installed on all Windows 10/11).
    this.monitor.start()

    this.cacheRefreshTimer = setInterval(() => {
      this.updateProcessCache()
    }, 30000)

    this.periodicFlushTimer = setInterval(() => {
      if (this.state.sessionId !== null && this.state.programId !== null && this.state.startTime) {
        this.flushSessionKeepAlive()
      }
    }, 10000)
  }

  stop(): void {
    if (!this.isRunning) return
    this.isRunning = false

    if (this.periodicFlushTimer) {
      clearInterval(this.periodicFlushTimer)
      this.periodicFlushTimer = null
    }
    if (this.cacheRefreshTimer) {
      clearInterval(this.cacheRefreshTimer)
      this.cacheRefreshTimer = null
    }

    this.monitor.stop()

    if (this.intervalPoller) {
      this.intervalPoller.stop()
      this.intervalPoller = null
    }
    if (this.simplePoller) {
      this.simplePoller.stop()
      this.simplePoller = null
    }

    this.flushSession()
    this.state = {
      programId: null,
      sessionId: null,
      startTime: null,
      tickCount: 0
    }
    this.lastDetectedProcess = ''
  }

  updateProcessCache(): void {
    try {
      const programs: any[] = getPrograms()
      this.processCache.clear()
      for (const program of programs) {
        if (program.is_active) {
          this.processCache.set(program.process_name.toLowerCase(), {
            programId: program.id,
            processName: program.process_name
          })
        }
      }
    } catch (err) {
      console.error('[UsageTracker] Failed to update process cache:', err)
    }
  }

  private startIntervalPoller(): void {
    if (this.intervalPoller) return
    this.monitorType = 'IntervalPoller'
    this.intervalPoller = new IntervalPoller()
    this.intervalPoller.onProcessChange((processName) =>
      this.handleProcessChange(processName)
    )
    this.intervalPoller.start()
  }

  private startSimplePoller(): void {
    if (this.simplePoller) return
    this.monitorType = 'SimplePoller'
    this.simplePoller = new SimplePoller()
    this.simplePoller.onProcessChange((processName) =>
      this.handleProcessChange(processName)
    )
    this.simplePoller.start()
  }

  private handleProcessChange(processName: string): void {
    if (!this.isRunning) return

    this.state.tickCount++
    this.lastDetectedProcess = processName

    if (!processName) {
      if (this.state.programId !== null) {
        this.flushSession()
        this.state.programId = null
        this.state.sessionId = null
        this.state.startTime = null
      }
      this.sendTick()
      return
    }

    // Ignore our own app window
    const processNameLower = processName.toLowerCase()
    if (processNameLower === this.selfProcessName) {
      this.sendTick()
      return
    }
    const cached = this.processCache.get(processNameLower)

    if (!cached) {
      if (this.state.programId !== null) {
        this.flushSession()
        this.state.programId = null
        this.state.sessionId = null
        this.state.startTime = null
      }
      this.sendTick()
      return
    }

    if (this.state.programId === cached.programId) {
      const now = new Date()
      if (this.state.startTime) {
        const elapsedMs = now.getTime() - this.state.startTime.getTime()
        const elapsedSeconds = Math.round(elapsedMs / 1000)
        updateSessionDuration(this.state.sessionId!, elapsedSeconds)
      }
    } else {
      this.flushSession()

      const session = startSession(cached.programId)
      this.state.programId = cached.programId
      this.state.sessionId = session.id as number
      this.state.startTime = new Date()
    }

    if (this.state.tickCount % 3 === 0) {
      this.sendTick()
    }
  }

  private flushSession(): void {
    if (
      this.state.sessionId !== null &&
      this.state.programId !== null &&
      this.state.startTime
    ) {
      try {
        const now = new Date()
        const elapsedMs = now.getTime() - this.state.startTime.getTime()
        const elapsedSeconds = Math.round(elapsedMs / 1000)
        if (elapsedSeconds > 0) {
          endSession(this.state.sessionId)
        }
      } catch (err) {
        console.error('[UsageTracker] Failed to flush session:', err)
      }
    }
  }

  private flushSessionKeepAlive(): void {
    if (this.state.sessionId === null || this.state.programId === null || !this.state.startTime) return
    try {
      const now = new Date()
      const elapsedMs = now.getTime() - this.state.startTime.getTime()
      const elapsedSeconds = Math.round(elapsedMs / 1000)
      if (elapsedSeconds > 0) {
        updateSessionDuration(this.state.sessionId, elapsedSeconds)
      }
    } catch (err) {
      console.error('[UsageTracker] Failed to flush session keep-alive:', err)
    }
  }

  private sendTick(): void {
    if (this.mainWindow.isDestroyed()) return

    try {
      const todayUsage: any[] = getTodayUsage()
      let currentProgram: any = null

      if (this.state.programId !== null && this.state.startTime) {
        const elapsedMs = Date.now() - this.state.startTime.getTime()
        const elapsedSeconds = Math.round(elapsedMs / 1000)

        let programName = ''
        let processName = ''
        for (const [, entry] of this.processCache) {
          if (entry.programId === this.state.programId) {
            programName = entry.processName.replace('.exe', '')
            processName = entry.processName
            break
          }
        }

        currentProgram = {
          programId: this.state.programId,
          programName,
          processName,
          elapsedSeconds
        }
      }

      this.mainWindow.webContents.send('tracking:tick', {
        currentProgram,
        detectedProcess: this.lastDetectedProcess || null,
        todayUsage
      })

      // Notify goal completion checker on each tick (~3s)
      if (this.tickCallback) {
        try {
          const prog = currentProgram ? { programId: currentProgram.programId, elapsedSeconds: currentProgram.elapsedSeconds } : null
          this.tickCallback(prog)
        } catch {}
      }
    } catch (err) {
      console.error('[UsageTracker] Failed to send tracking tick:', err)
    }
  }
}
