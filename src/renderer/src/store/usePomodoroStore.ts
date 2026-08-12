import { create } from 'zustand'
import type { PomodoroStatus, PomodoroPhase, PomodoroState } from '../types/index'

interface PomodoroStateStore {
  status: PomodoroStatus
  phase: PomodoroPhase
  remainingSeconds: number
  totalSeconds: number
  currentCycle: number
  totalCycles: number

  floatingBallEnabled: boolean
  recentSessions: Array<{ phase: string; durationSeconds: number; completedAt: string }>

  updateFromMain: (state: PomodoroState) => void
  setState: (state: PomodoroState) => void
  reset: () => void
  setFloatingBallEnabled: (enabled: boolean) => void
}

const initialState = {
  status: 'idle' as PomodoroStatus,
  phase: 'work' as PomodoroPhase,
  remainingSeconds: 0,
  totalSeconds: 0,
  currentCycle: 0,
  totalCycles: 0,
  floatingBallEnabled: true,
  recentSessions: [] as Array<{ phase: string; durationSeconds: number; completedAt: string }>,
}

export const usePomodoroStore = create<PomodoroStateStore>((set) => ({
  ...initialState,

  updateFromMain: (state: PomodoroState) => {
    set({
      status: state.status,
      phase: state.phase,
      remainingSeconds: state.remainingSeconds,
      totalSeconds: state.totalSeconds,
      currentCycle: state.currentCycle,
      totalCycles: state.totalCycles,
    })
  },

  setState: (state: PomodoroState) => {
    set({
      status: state.status,
      phase: state.phase,
      remainingSeconds: state.remainingSeconds,
      totalSeconds: state.totalSeconds,
      currentCycle: state.currentCycle,
      totalCycles: state.totalCycles,
    })
  },

  setFloatingBallEnabled: (enabled: boolean) => set({ floatingBallEnabled: enabled }),

  reset: () => set({ ...initialState }),
}))
