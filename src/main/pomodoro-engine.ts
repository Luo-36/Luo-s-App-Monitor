import { BrowserWindow, Notification } from 'electron'
import { addPomodoroSession, getUserProfile, updateUserProfile } from './database'

interface PomodoroConfig {
  workMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  cycles: number
}

export type PomodoroPhase = 'work' | 'break' | 'long_break'
export type PomodoroStatus = 'idle' | 'running' | 'paused'

export interface PomodoroState {
  status: PomodoroStatus
  phase: PomodoroPhase
  remainingSeconds: number
  totalSeconds: number
  currentCycle: number
  totalCycles: number
}

export class PomodoroEngine {
  private mainWindow: BrowserWindow
  private config: PomodoroConfig | null = null
  private state: PomodoroState = {
    status: 'idle',
    phase: 'work',
    remainingSeconds: 0,
    totalSeconds: 0,
    currentCycle: 1,
    totalCycles: 4
  }
  private tickInterval: NodeJS.Timeout | null = null
  private phaseTimeout: NodeJS.Timeout | null = null
  private onCompleteCallback: (() => void) | null = null
  private onTickCallback: ((state: PomodoroState) => void) | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
  }

  start(config: PomodoroConfig): void {
    if (this.state.status === 'running') return

    this.config = config
    this.state = {
      status: 'running',
      phase: 'work',
      remainingSeconds: config.workMinutes * 60,
      totalSeconds: config.workMinutes * 60,
      currentCycle: 1,
      totalCycles: config.cycles
    }

    this.startTickInterval()
    this.sendState()
  }

  pause(): void {
    if (this.state.status !== 'running') return

    this.state.status = 'paused'
    this.clearIntervals()
    this.sendState()
  }

  resume(): void {
    if (this.state.status !== 'paused') return

    this.state.status = 'running'
    this.startTickInterval()
    this.sendState()
  }

  stop(): void {
    this.clearIntervals()
    this.state = {
      status: 'idle',
      phase: 'work',
      remainingSeconds: 0,
      totalSeconds: 0,
      currentCycle: 1,
      totalCycles: this.config?.cycles ?? 4
    }
    this.sendState()
  }

  getState(): PomodoroState {
    return { ...this.state }
  }

  private startTickInterval(): void {
    this.clearIntervals()

    // Send tick every second
    this.tickInterval = setInterval(() => {
      if (this.state.status !== 'running') return

      this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - 1)
      this.sendState()

      // Check if phase is complete
      if (this.state.remainingSeconds <= 0) {
        this.onPhaseComplete()
      }
    }, 1000)
  }

  private onPhaseComplete(): void {
    this.clearIntervals()

    const now = new Date()
    const dateStr = now.toISOString().slice(0, 10)

    // Record completed session in database
    try {
      addPomodoroSession({
        session_type: this.state.phase,
        planned_duration: this.state.totalSeconds,
        actual_duration: this.state.totalSeconds - this.state.remainingSeconds,
        completed: true,
        start_time: now.toISOString(),
        end_time: now.toISOString(),
        date: dateStr
      })
    } catch (err) {
      console.error('Failed to record pomodoro session:', err)
    }

    // Determine next phase
    if (this.state.phase === 'work') {
      if (this.state.currentCycle >= this.state.totalCycles) {
        // All work cycles complete — award a heart and finish
        try {
          const profile = getUserProfile()
          if (profile) {
            updateUserProfile({ hearts_count: (profile.hearts_count || 0) + 1 })
            if (!this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('profile:updated', { hearts_count: profile.hearts_count + 1 })
            }
          }
        } catch (err) {
          console.error('Failed to award heart for pomodoro:', err)
        }

        // Completion notification
        try {
          if (!this.mainWindow.isDestroyed()) {
            const notif = new Notification({
              title: '番茄钟完成! 🎉',
              body: `你完成了 ${this.state.totalCycles} 轮番茄钟! 获得一颗♥`
            })
            notif.show()
          }
        } catch {}

        // Transition to long break as a reward
        this.state.phase = 'long_break'
        this.state.remainingSeconds = (this.config?.longBreakMinutes ?? 15) * 60
        this.state.totalSeconds = this.state.remainingSeconds
        // NOTE: keep currentCycle so the UI shows completion; reset on idle below
      } else {
        // Switch to break
        this.state.phase = 'break'
        this.state.remainingSeconds = (this.config?.breakMinutes ?? 5) * 60
        this.state.totalSeconds = this.state.remainingSeconds

        // Break start notification
        try {
          if (!this.mainWindow.isDestroyed()) {
            const notif = new Notification({
              title: '休息时间 ☕',
              body: `休息 ${this.config?.breakMinutes ?? 5} 分钟，放松一下吧`
            })
            notif.show()
          }
        } catch {}
      }
    } else if (this.state.phase === 'long_break') {
      // Long break is over — go idle
      this.state.status = 'idle'
      this.state.phase = 'work'
      this.state.currentCycle = 1
      this.state.remainingSeconds = 0
      this.state.totalSeconds = 0
      this.sendState()

      if (this.onCompleteCallback) {
        this.onCompleteCallback()
      }
      return
    } else {
      // Short break is over, start next work cycle
      this.state.phase = 'work'
      this.state.remainingSeconds = (this.config?.workMinutes ?? 25) * 60
      this.state.totalSeconds = this.state.remainingSeconds
      this.state.currentCycle++

      // Work start notification
      try {
        if (!this.mainWindow.isDestroyed()) {
          const notif = new Notification({
            title: '工作时间 💪',
            body: `第 ${this.state.currentCycle}/${this.state.totalCycles} 轮，专注 ${this.config?.workMinutes ?? 25} 分钟`
          })
          notif.show()
        }
      } catch {}
    }

    // Start the next phase
    this.state.status = 'running'
    this.startTickInterval()
    this.sendState()
  }

  private clearIntervals(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    if (this.phaseTimeout) {
      clearTimeout(this.phaseTimeout)
      this.phaseTimeout = null
    }
  }

  private sendState(): void {
    if (this.mainWindow.isDestroyed()) return

    const state = this.getState()

    try {
      this.mainWindow.webContents.send('pomodoro:tick', state)
    } catch (err) {
      console.error('Failed to send pomodoro state:', err)
    }

    // Notify secondary listeners (e.g. floating ball window)
    if (this.onTickCallback) {
      try {
        this.onTickCallback(state)
      } catch (err) {
        console.error('Failed to notify onTick callback:', err)
      }
    }
  }

  /**
   * Registers a callback for when a full pomodoro cycle (all work/break rounds) completes.
   */
  onComplete(callback: () => void): void {
    this.onCompleteCallback = callback
  }

  /**
   * Registers a callback that fires on every pomodoro tick (each second).
   * Useful for secondary renderers such as the floating ball window.
   */
  onTick(callback: (state: PomodoroState) => void): void {
    this.onTickCallback = callback
  }

  /**
   * Clean up all resources.
   */
  destroy(): void {
    this.clearIntervals()
    this.config = null
    this.onCompleteCallback = null
  }
}
