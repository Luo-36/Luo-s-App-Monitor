import { create } from 'zustand'
import type { UsageEntry, TrackingTick } from '../types/index'
import { sortByTodayUsage, sortByTotalUsage } from '../utils/sort'

type SortMode = 'today' | 'total'

interface TrackingState {
  todayUsage: UsageEntry[]
  currentProgram: TrackingTick['currentProgram']
  detectedProcess: string | null
  sortMode: SortMode
  sortAscending: boolean

  setTodayUsage: (entries: UsageEntry[]) => void
  setCurrentProgram: (prog: TrackingTick['currentProgram']) => void
  setSortMode: (mode: SortMode) => void
  toggleSortOrder: () => void

  /** Computed: sorted entries based on current sortMode and order */
  sortedUsage: () => UsageEntry[]
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  todayUsage: [],
  currentProgram: null,
  detectedProcess: null,
  sortMode: 'today',
  sortAscending: false,

  setTodayUsage: (entries: UsageEntry[]) => set({ todayUsage: entries }),

  setCurrentProgram: (prog: TrackingTick['currentProgram']) =>
    set({ currentProgram: prog }),

  setSortMode: (mode: SortMode) => set({ sortMode: mode }),

  toggleSortOrder: () =>
    set((state) => ({ sortAscending: !state.sortAscending })),

  /** Update from a tracking tick event (called by IPC listener) */
  updateFromTick: (data: TrackingTick) => {
    set({
      currentProgram: data.currentProgram,
      detectedProcess: data.detectedProcess,
      todayUsage: data.todayUsage,
    })
  },

  sortedUsage: () => {
    const { todayUsage, sortMode, sortAscending } = get()
    if (sortMode === 'today') {
      return sortByTodayUsage(todayUsage, sortAscending)
    }
    return sortByTotalUsage(todayUsage, sortAscending)
  },
}))
