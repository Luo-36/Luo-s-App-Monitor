// ====== Program Types ======
export interface Program {
  id: number
  name: string
  process_name: string
  icon_path: string | null
  card_image_path: string | null
  category: string | null
  is_active: number
  created_at: string
}

export interface CreateProgramDTO {
  name: string
  process_name: string
  icon_path?: string | null
  card_image_path?: string | null
  category?: string | null
}

/** Per-program usage over a date range, used for the category breakdown. */
export interface ProgramRangeUsage {
  program_id: number
  program_name: string
  category: string | null
  total_seconds: number
}

// ====== Usage Tracking Types ======
export interface UsageEntry {
  program_id: number
  program_name: string
  process_name: string
  icon_path: string | null
  card_image_path: string | null
  total_seconds: number
}

export interface DailyUsage {
  date: string
  total_seconds: number
}

export interface TrackingTick {
  currentProgram: {
    programId: number
    programName: string
    processName: string
    elapsedSeconds: number
  } | null
  detectedProcess: string | null
  todayUsage: UsageEntry[]
}

// ====== Goal Types ======
export interface Goal {
  id: number
  name: string
  description: string | null
  goal_type: 'achievement' | 'restriction'
  daily_limit_seconds: number
  remind_time: string | null
  remind_enabled: number
  card_image_path: string | null
  program_ids: number[]
  is_active: number
  created_at: string
  current_progress?: number // computed: today's usage summed across related programs
  hearts_earned?: number // computed: completion count
}

export interface GoalCompletion {
  id: number
  goal_id: number
  date: string
  achieved_seconds: number
}

export interface CreateGoalDTO {
  name: string
  description?: string | null
  goal_type?: 'achievement' | 'restriction'
  daily_limit_seconds: number
  remind_time?: string | null
  remind_enabled?: number
  card_image_path?: string | null
  program_ids?: number[]
}

/** Returns the display label for a goal type */
export function getGoalTypeLabel(type: 'achievement' | 'restriction'): string {
  return type === 'achievement' ? '要求时长' : '限制时长'
}

// ====== User Profile Types ======
export interface UserProfile {
  id: number
  nickname: string
  bio: string
  avatar_path: string | null
  hearts_count: number
  theme_color: string
  background_image_path: string | null
  background_dim: number
  pomodoro_work_minutes: number
  pomodoro_break_minutes: number
  pomodoro_long_break_minutes: number
  pomodoro_cycles: number
  pomodoro_floating_ball_image: string | null
  pomodoro_floating_ball_enabled: number
  floating_ball_color: string
  gui_scale: number
  auto_start: number
  todo_floating_enabled: number
  todo_floating_ball_image: string | null
  pomodoro_ball_size: number
  /** 'circle' | 'square' */
  pomodoro_ball_shape: string
  todo_ball_size: number
  /** 'circle' | 'square' */
  todo_ball_shape: string
  /** Whether system notifications are mirrored as chat bubbles near the todo ball. */
  todo_floating_chat_notifications: number
}

// ====== Todo / Reminder Types ======
export interface Todo {
  id: number
  title: string
  is_done: number
  created_at: string
}

export interface Reminder {
  id: number
  title: string
  /** Epoch milliseconds when the notification should fire. */
  remind_at: number
  created_at: string
}

// ====== Pomodoro Types ======
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

export interface PomodoroConfig {
  workMinutes: number
  breakMinutes: number
  longBreakMinutes: number
  cycles: number
}

// ====== Image / Crop Types ======
export interface CropData {
  x: number
  y: number
  width: number
  height: number
}

// ====== IPC API Interface ======
export interface ElectronAPI {
  // Programs
  addProgram(data: CreateProgramDTO): Promise<Program>
  updateProgram(id: number, data: Partial<Program>): Promise<Program>
  deleteProgram(id: number): Promise<void>
  getPrograms(): Promise<Program[]>
  getProgram(id: number): Promise<Program | null>

  // Usage tracking
  getTodayUsage(): Promise<UsageEntry[]>
  getTotalUsage(): Promise<UsageEntry[]>
  getProgramUsage(programId: number, range: '7d' | '30d'): Promise<DailyUsage[]>
  /** Seconds used per local hour (24 entries, index 0 = 0:00). */
  getProgramHourlyUsage(programId: number, date: string): Promise<number[]>
  /** Per-program usage between two local dates (inclusive). */
  getProgramUsageRange(startDate: string, endDate: string): Promise<ProgramRangeUsage[]>

  // Goals
  addGoal(data: CreateGoalDTO): Promise<Goal>
  updateGoal(id: number, data: Partial<Goal>): Promise<Goal>
  deleteGoal(id: number): Promise<void>
  getGoals(): Promise<Goal[]>
  getGoal(id: number): Promise<Goal | null>
  checkGoalCompletion(date: string): Promise<void>
  getGoalCompletions(goalId: number): Promise<GoalCompletion[]>

  // Todos
  getTodos(): Promise<Todo[]>
  addTodo(title: string): Promise<Todo | null>
  toggleTodo(id: number): Promise<Todo | null>
  updateTodo(id: number, data: { title?: string; is_done?: number }): Promise<Todo | null>
  deleteTodo(id: number): Promise<void>
  clearCompletedTodos(): Promise<void>
  getTodoFloatingEnabled(): Promise<boolean>
  setTodoFloatingEnabled(enabled: boolean): Promise<boolean>

  // Reminders
  getReminders(): Promise<Reminder[]>
  addReminder(title: string, delayMinutes: number): Promise<Reminder | null>
  deleteReminder(id: number): Promise<void>

  // Profile
  getProfile(): Promise<UserProfile>
  updateProfile(data: Partial<UserProfile>): Promise<UserProfile>

  // Settings
  setAutoStart(enabled: boolean): Promise<void>
  getAutoStart(): Promise<boolean>

  // Images
  openFileDialog(filters?: { name: string; extensions: string[] }[]): Promise<string | null>
  readFileAsBase64(filePath: string): Promise<string | null>
  cropImage(sourcePath: string, outputName: string, x: number, y: number, w: number, h: number): Promise<string | null>
  saveImage(base64Data: string, folder: string, fileName: string): Promise<string>
  deleteImage(fileName: string): Promise<void>
  getImagePath(fileName: string): Promise<string>
  saveBackgroundImage(filePath: string): Promise<string | null>
  clearAllData(): Promise<void>
  exportData(): Promise<string | null>
  importData(): Promise<boolean>

  // Icon Extraction
  extractExeIcon(exePath: string): Promise<string | null>

  // Pomodoro
  startPomodoro(config: PomodoroConfig): void
  pausePomodoro(): void
  resumePomodoro(): void
  stopPomodoro(): void
  getPomodoroState(): Promise<PomodoroState>

  // Events (main -> renderer)
  onTrackingTick(callback: (data: TrackingTick) => void): () => void
  onPomodoroTick(callback: (state: PomodoroState) => void): () => void
  onGoalReminder(callback: (goal: Goal) => void): () => void
  onVisibilityChange(callback: (visible: boolean) => void): () => void
  onProfileUpdated(callback: (data: { hearts_count: number }) => void): () => void
  onTodosChanged(callback: () => void): () => void
  onRemindersChanged(callback: () => void): () => void
  onReminderFired(callback: (title: string) => void): () => void
  onTodoFloatingState(callback: (enabled: boolean) => void): () => void

  // Floating Ball
  setFloatingBallEnabled(enabled: boolean): Promise<boolean>
  getFloatingBallEnabled(): Promise<boolean>

  // Window Capture
  startCapture(): Promise<void>
  stopCapture(): Promise<void>
  onCaptureDetected(callback: (processName: string) => void): () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
