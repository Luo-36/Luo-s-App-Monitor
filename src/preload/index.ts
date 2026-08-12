import { contextBridge, ipcRenderer } from 'electron'
import type { ElectronAPI, CreateProgramDTO, Program, Goal, CreateGoalDTO, UserProfile, PomodoroConfig, PomodoroState, TrackingTick } from '../renderer/src/types/index'

// Remove duplicate listeners to avoid accumulation
function safeOn(channel: string, callback: (...args: any[]) => void): () => void {
  const wrapper = (_event: Electron.IpcRendererEvent, ...args: any[]) => callback(...args)
  ipcRenderer.removeListener(channel, wrapper as any)
  ipcRenderer.on(channel, wrapper as any)
  return () => {
    ipcRenderer.removeListener(channel, wrapper as any)
  }
}

const electronAPI: ElectronAPI = {
  // ===== Programs =====
  addProgram(data: CreateProgramDTO): Promise<Program> {
    return ipcRenderer.invoke('program:add', data)
  },

  updateProgram(id: number, data: Partial<Program>): Promise<Program> {
    return ipcRenderer.invoke('program:update', id, data)
  },

  deleteProgram(id: number): Promise<void> {
    return ipcRenderer.invoke('program:delete', id)
  },

  getPrograms(): Promise<Program[]> {
    return ipcRenderer.invoke('program:getAll')
  },

  getProgram(id: number): Promise<Program | null> {
    return ipcRenderer.invoke('program:get', id)
  },

  // ===== Usage Tracking =====
  getTodayUsage(): Promise<import('../renderer/src/types/index').UsageEntry[]> {
    return ipcRenderer.invoke('usage:getToday')
  },

  getTotalUsage(): Promise<import('../renderer/src/types/index').UsageEntry[]> {
    return ipcRenderer.invoke('usage:getTotal')
  },

  getProgramUsage(programId: number, range: '7d' | '30d'): Promise<import('../renderer/src/types/index').DailyUsage[]> {
    return ipcRenderer.invoke('usage:getProgram', programId, range)
  },

  // ===== Goals =====
  addGoal(data: CreateGoalDTO): Promise<Goal> {
    return ipcRenderer.invoke('goal:add', data)
  },

  updateGoal(id: number, data: Partial<Goal>): Promise<Goal> {
    return ipcRenderer.invoke('goal:update', id, data)
  },

  deleteGoal(id: number): Promise<void> {
    return ipcRenderer.invoke('goal:delete', id)
  },

  getGoals(): Promise<Goal[]> {
    return ipcRenderer.invoke('goal:getAll')
  },

  getGoal(id: number): Promise<Goal | null> {
    return ipcRenderer.invoke('goal:get', id)
  },

  checkGoalCompletion(date: string): Promise<void> {
    return ipcRenderer.invoke('goal:checkCompletion', date)
  },

  getGoalCompletions(goalId: number): Promise<import('../renderer/src/types/index').GoalCompletion[]> {
    return ipcRenderer.invoke('goal:getCompletions', goalId)
  },

  // ===== Profile =====
  getProfile(): Promise<UserProfile> {
    return ipcRenderer.invoke('profile:get')
  },

  updateProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    return ipcRenderer.invoke('profile:update', data)
  },

  // ===== Settings =====
  setAutoStart(enabled: boolean): Promise<void> {
    return ipcRenderer.invoke('settings:setAutoStart', enabled)
  },

  getAutoStart(): Promise<boolean> {
    return ipcRenderer.invoke('settings:getAutoStart')
  },

  // ===== Images =====
  openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null> {
    return ipcRenderer.invoke('dialog:openFile', filters)
  },

  readFileAsBase64(filePath: string): Promise<string | null> {
    return ipcRenderer.invoke('file:readBase64', filePath)
  },

  cropImage(sourcePath: string, outputName: string, x: number, y: number, w: number, h: number): Promise<string | null> {
    return ipcRenderer.invoke('image:crop', sourcePath, outputName, x, y, w, h)
  },

  saveImage(base64Data: string, folder: string, fileName: string): Promise<string> {
    return ipcRenderer.invoke('image:save', base64Data, folder, fileName)
  },

  deleteImage(fileName: string): Promise<void> {
    return ipcRenderer.invoke('image:delete', fileName)
  },

  getImagePath(fileName: string): Promise<string> {
    return ipcRenderer.invoke('image:getPath', fileName)
  },

  clearAllData(): Promise<void> {
    return ipcRenderer.invoke('data:clearAll')
  },

  saveBackgroundImage(filePath: string): Promise<string | null> {
    return ipcRenderer.invoke('image:saveBackground', filePath)
  },

  extractExeIcon(exePath: string): Promise<string | null> {
    return ipcRenderer.invoke('icon:extractFromExe', exePath)
  },

  // ===== Pomodoro =====
  startPomodoro(config: PomodoroConfig): void {
    ipcRenderer.invoke('pomodoro:start', config)
  },

  pausePomodoro(): void {
    ipcRenderer.invoke('pomodoro:pause')
  },

  resumePomodoro(): void {
    ipcRenderer.invoke('pomodoro:resume')
  },

  stopPomodoro(): void {
    ipcRenderer.invoke('pomodoro:stop')
  },

  getPomodoroState(): Promise<PomodoroState> {
    return ipcRenderer.invoke('pomodoro:getState')
  },

  // ===== Floating Ball =====
  setFloatingBallEnabled(enabled: boolean): Promise<boolean> {
    return ipcRenderer.invoke('floatingball:toggle', enabled)
  },

  getFloatingBallEnabled(): Promise<boolean> {
    return ipcRenderer.invoke('floatingball:getState')
  },

  // ===== Events (main -> renderer) =====
  onTrackingTick(callback: (data: TrackingTick) => void): () => void {
    return safeOn('tracking:tick', callback)
  },

  onPomodoroTick(callback: (state: PomodoroState) => void): () => void {
    return safeOn('pomodoro:tick', callback)
  },

  onGoalReminder(callback: (goal: Goal) => void): () => void {
    return safeOn('goal:reminder', callback)
  },

  onVisibilityChange(callback: (visible: boolean) => void): () => void {
    return safeOn('visibility:change', callback)
  },

  onProfileUpdated(callback: (data: { hearts_count: number }) => void): () => void {
    return safeOn('profile:updated', callback)
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  ...electronAPI,
  platform: process.platform
})
