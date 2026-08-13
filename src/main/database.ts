import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

/**
 * Returns the local date as "YYYY-MM-DD".
 *
 * NOTE: new Date().toISOString() returns UTC time, which in UTC+8 (China) would
 * attribute the first 8 hours of each day to the previous day. Use local time
 * fields instead to keep daily usage/goal tracking aligned with wall-clock time.
 */
export function localDate(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function initDatabase(): void {
  const userDataPath = app.getPath('userData')
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true })
  }

  const dbPath = path.join(userDataPath, 'luo.db')
  db = new Database(dbPath)

  // Enable WAL mode for better concurrent performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  createTables()
  runMigrations()
  migrateDefaultProfile()
}

function createTables(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      process_name TEXT NOT NULL UNIQUE,
      icon_path TEXT,
      card_image_path TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS usage_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    )
  `)
  // Indexes for usage_sessions
  db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_sessions_program_id ON usage_sessions(program_id)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_sessions_date ON usage_sessions(date)`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_usage_sessions_start_time ON usage_sessions(start_time)`)

  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_usage (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      UNIQUE(program_id, date),
      FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      daily_limit_seconds INTEGER NOT NULL,
      remind_time TEXT,
      remind_enabled INTEGER NOT NULL DEFAULT 1,
      card_image_path TEXT,
      program_id INTEGER,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_completions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      achieved_seconds INTEGER NOT NULL,
      UNIQUE(goal_id, date),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS goal_programs (
      goal_id INTEGER NOT NULL,
      program_id INTEGER NOT NULL,
      PRIMARY KEY (goal_id, program_id),
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS user_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL DEFAULT 'User',
      bio TEXT NOT NULL DEFAULT '',
      avatar_path TEXT,
      hearts_count INTEGER NOT NULL DEFAULT 0,
      theme_color TEXT NOT NULL DEFAULT 'taupe',
      background_image_path TEXT,
      background_dim REAL NOT NULL DEFAULT 0.5,
      pomodoro_work_minutes INTEGER NOT NULL DEFAULT 25,
      pomodoro_break_minutes INTEGER NOT NULL DEFAULT 5,
      pomodoro_long_break_minutes INTEGER NOT NULL DEFAULT 15,
      pomodoro_cycles INTEGER NOT NULL DEFAULT 4,
      pomodoro_floating_ball_image TEXT,
      pomodoro_floating_ball_enabled INTEGER NOT NULL DEFAULT 0,
      auto_start INTEGER NOT NULL DEFAULT 0
    )
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS pomodoro_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_type TEXT NOT NULL CHECK(session_type IN ('work', 'break', 'long_break')),
      planned_duration INTEGER NOT NULL,
      actual_duration INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      start_time TEXT NOT NULL,
      end_time TEXT,
      date TEXT NOT NULL
    )
  `)
}

function runMigrations(): void {
  migrateGoalsAddGoalType()
  migrateUserProfileAddGuiScale()
  migrateUserProfileAddFloatingBallColor()
  migrateGoalsToJunctionTable()
}

/**
 * Migrates the legacy single `goals.program_id` into the many-to-many
 * `goal_programs` junction table. Idempotent (INSERT OR IGNORE on the
 * composite PK means re-runs are no-ops).
 */
function migrateGoalsToJunctionTable(): void {
  db.exec(`
    INSERT OR IGNORE INTO goal_programs (goal_id, program_id)
    SELECT id, program_id FROM goals WHERE program_id IS NOT NULL
  `)
}

function migrateGoalsAddGoalType(): void {
  // Add goal_type column to goals table if it doesn't exist
  const columns: any[] = db.prepare('PRAGMA table_info(goals)').all()
  const hasGoalType = columns.some((col: any) => col.name === 'goal_type')
  if (!hasGoalType) {
    db.exec(`
      ALTER TABLE goals
      ADD COLUMN goal_type TEXT NOT NULL DEFAULT 'achievement'
      CHECK(goal_type IN ('achievement', 'restriction'))
    `)
  }
}

function migrateDefaultProfile(): void {
  // Insert default profile row if none exists (singleton pattern)
  db.exec(`
    INSERT OR IGNORE INTO user_profile (id) VALUES (1)
  `)
}

function migrateUserProfileAddGuiScale(): void {
  // Add gui_scale column to user_profile if it doesn't exist
  const columns: any[] = db.prepare('PRAGMA table_info(user_profile)').all()
  const hasGuiScale = columns.some((col: any) => col.name === 'gui_scale')
  if (!hasGuiScale) {
    db.exec(`
      ALTER TABLE user_profile
      ADD COLUMN gui_scale INTEGER NOT NULL DEFAULT 100
    `)
  }
}

function migrateUserProfileAddFloatingBallColor(): void {
  const columns: any[] = db.prepare('PRAGMA table_info(user_profile)').all()
  const hasColor = columns.some((col: any) => col.name === 'floating_ball_color')
  if (!hasColor) {
    db.exec(`
      ALTER TABLE user_profile
      ADD COLUMN floating_ball_color TEXT NOT NULL DEFAULT 'taupe'
    `)
  }
}

// ==================== Helpers ====================

/**
 * Normalize a JS value into something better-sqlite3 can bind.
 * Converts booleans → 0/1 and undefined → null.
 */
function toSQLiteValue(value: unknown): number | string | bigint | Buffer | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'boolean') return value ? 1 : 0
  return value as number | string | bigint | Buffer | null
}

// ==================== Programs ====================

export function getPrograms(): any[] {
  return db.prepare('SELECT * FROM programs ORDER BY name ASC').all()
}

export function getProgram(id: number): any {
  return db.prepare('SELECT * FROM programs WHERE id = ?').get(id)
}

export function addProgram(data: { name: string; process_name: string; icon_path?: string | null; card_image_path?: string | null }): any {
  const stmt = db.prepare(`
    INSERT INTO programs (name, process_name, icon_path, card_image_path)
    VALUES (@name, @process_name, @icon_path, @card_image_path)
  `)
  const result = stmt.run({
    name: data.name,
    process_name: data.process_name,
    icon_path: data.icon_path ?? null,
    card_image_path: data.card_image_path ?? null
  })
  return db.prepare('SELECT * FROM programs WHERE id = ?').get(result.lastInsertRowid)
}

export function updateProgram(id: number, data: Partial<any>): any {
  const fields: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id') {
      fields.push(`${key} = ?`)
      values.push(toSQLiteValue(value))
    }
  }

  if (fields.length === 0) {
    return getProgram(id)
  }

  values.push(id)
  db.prepare(`UPDATE programs SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return db.prepare('SELECT * FROM programs WHERE id = ?').get(id)
}

export function deleteProgram(id: number): void {
  db.prepare('DELETE FROM programs WHERE id = ?').run(id)
}

// ==================== Daily Usage ====================

export function getTodayUsage(): any[] {
  const today = localDate()
  return db
    .prepare(
      `
      SELECT
        p.id AS program_id,
        p.name AS program_name,
        p.process_name,
        p.icon_path,
        p.card_image_path,
        COALESCE(du.total_seconds, 0) AS total_seconds
      FROM programs p
      LEFT JOIN daily_usage du ON du.program_id = p.id AND du.date = ?
      WHERE p.is_active = 1
      ORDER BY total_seconds DESC
    `
    )
    .all(today)
}

export function getTotalUsage(): any[] {
  return db
    .prepare(
      `
      SELECT
        p.id AS program_id,
        p.name AS program_name,
        p.process_name,
        p.icon_path,
        p.card_image_path,
        COALESCE(SUM(du.total_seconds), 0) AS total_seconds
      FROM programs p
      LEFT JOIN daily_usage du ON du.program_id = p.id
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY total_seconds DESC
    `
    )
    .all()
}

export function getProgramUsage(programId: number, range: '7d' | '30d'): any[] {
  const days = range === '7d' ? 7 : 30
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - days)
  const cutoff = localDate(cutoffDate)

  return db
    .prepare(
      `
      SELECT date, total_seconds
      FROM daily_usage
      WHERE program_id = ? AND date >= ?
      ORDER BY date ASC
    `
    )
    .all(programId, cutoff)
}

// ==================== Sessions ====================

export function startSession(programId: number): any {
  const now = new Date()
  const dateStr = localDate(now)
  const timeStr = now.toISOString()

  const result = db
    .prepare(
      `
    INSERT INTO usage_sessions (program_id, start_time, date)
    VALUES (?, ?, ?)
  `
    )
    .run(programId, timeStr, dateStr)

  return { id: result.lastInsertRowid, program_id: programId, start_time: timeStr, date: dateStr }
}

export function endSession(sessionId: number): void {
  const now = new Date()
  const timeStr = now.toISOString()

  // Get session start time to calculate duration
  const session: any = db.prepare('SELECT * FROM usage_sessions WHERE id = ?').get(sessionId)
  if (!session) return

  const startTime = new Date(session.start_time).getTime()
  const endTime = now.getTime()
  const durationSeconds = Math.round((endTime - startTime) / 1000)

  db.prepare('UPDATE usage_sessions SET end_time = ?, duration_seconds = ? WHERE id = ?').run(
    timeStr,
    durationSeconds,
    sessionId
  )

  // Add this session's duration to daily_usage (each session accumulates)
  upsertDailyUsage(session.program_id, session.date, durationSeconds)
}

export function updateSessionDuration(sessionId: number, duration: number): void {
  db.prepare('UPDATE usage_sessions SET duration_seconds = ? WHERE id = ?').run(duration, sessionId)
}

export function upsertDailyUsage(programId: number, date: string, seconds: number): void {
  db.prepare(
    `
    INSERT INTO daily_usage (program_id, date, total_seconds)
    VALUES (?, ?, ?)
    ON CONFLICT(program_id, date) DO UPDATE SET
      total_seconds = total_seconds + ?
  `
  ).run(programId, date, seconds, seconds)
}

/**
 * Set daily_usage to an exact value (replaces, not adds).
 * Used for periodic mid-session flush so daily_usage stays up to date.
 */
export function setDailyUsage(programId: number, date: string, seconds: number): void {
  db.prepare(
    `
    INSERT INTO daily_usage (program_id, date, total_seconds)
    VALUES (?, ?, ?)
    ON CONFLICT(program_id, date) DO UPDATE SET
      total_seconds = ?
  `
  ).run(programId, date, seconds, seconds)
}

/** Returns total seconds for a specific program on a specific date. Returns 0 if no usage found. */
export function getProgramUsageForDate(programId: number, date: string): number {
  const result: any = db
    .prepare('SELECT total_seconds FROM daily_usage WHERE program_id = ? AND date = ?')
    .get(programId, date)
  return result?.total_seconds ?? 0
}

/** Returns total seconds across all programs on a specific date. Returns 0 if no usage found. */
export function getTotalUsageForDate(date: string): number {
  const result: any = db
    .prepare('SELECT COALESCE(SUM(total_seconds), 0) AS total FROM daily_usage WHERE date = ?')
    .get(date)
  return result?.total ?? 0
}

// ==================== Goals ====================

/** Returns the list of program ids associated with a goal. */
export function getGoalProgramIds(goalId: number): number[] {
  return db
    .prepare('SELECT program_id FROM goal_programs WHERE goal_id = ? ORDER BY program_id')
    .all(goalId)
    .map((r: any) => r.program_id)
}

/** Replaces a goal's associated programs with the given list. */
export function setGoalPrograms(goalId: number, programIds: number[]): void {
  db.prepare('DELETE FROM goal_programs WHERE goal_id = ?').run(goalId)
  const insert = db.prepare('INSERT OR IGNORE INTO goal_programs (goal_id, program_id) VALUES (?, ?)')
  for (const pid of programIds) {
    insert.run(goalId, pid)
  }
}

/**
 * Sums today's usage (from a usageMap keyed by program_id) across the given
 * program ids. Returns 0 when the list is empty.
 */
function sumUsage(programIds: number[], usageMap: Map<number, number>): number {
  return programIds.reduce((sum, pid) => sum + (usageMap.get(pid) ?? 0), 0)
}

export function getGoals(): any[] {
  const goals: any[] = db.prepare('SELECT * FROM goals ORDER BY created_at DESC').all()
  const today = localDate()
  const todayUsage: any[] = db
    .prepare(`
      SELECT program_id, total_seconds FROM daily_usage WHERE date = ?
    `).all(today)
  const usageMap = new Map(todayUsage.map((u: any) => [u.program_id, u.total_seconds]))
  const totalToday = todayUsage.reduce((sum: number, u: any) => sum + u.total_seconds, 0)

  return goals.map((goal: any) => {
    const programIds = getGoalProgramIds(goal.id)
    const current_progress = programIds.length > 0
      ? sumUsage(programIds, usageMap)
      : totalToday
    return { ...goal, program_ids: programIds, current_progress }
  })
}

export function getGoal(id: number): any {
  const goal: any = db.prepare('SELECT * FROM goals WHERE id = ?').get(id)
  if (!goal) return null
  const today = localDate()
  const programIds = getGoalProgramIds(goal.id)
  let current_progress = 0
  if (programIds.length > 0) {
    current_progress = programIds.reduce(
      (sum, pid) => sum + getProgramUsageForDate(pid, today),
      0
    )
  } else {
    current_progress = getTotalUsageForDate(today)
  }
  return { ...goal, program_ids: programIds, current_progress }
}

export function addGoal(data: {
  name: string
  description?: string | null
  daily_limit_seconds: number
  goal_type?: 'achievement' | 'restriction'
  remind_time?: string | null
  remind_enabled?: number
  card_image_path?: string | null
  program_ids?: number[]
}): any {
  const stmt = db.prepare(`
    INSERT INTO goals (name, description, daily_limit_seconds, goal_type, remind_time, remind_enabled, card_image_path)
    VALUES (@name, @description, @daily_limit_seconds, @goal_type, @remind_time, @remind_enabled, @card_image_path)
  `)
  const result = stmt.run({
    name: data.name,
    description: toSQLiteValue(data.description),
    daily_limit_seconds: data.daily_limit_seconds,
    goal_type: data.goal_type ?? 'achievement',
    remind_time: toSQLiteValue(data.remind_time),
    remind_enabled: toSQLiteValue(data.remind_enabled ?? true),
    card_image_path: toSQLiteValue(data.card_image_path)
  })
  const goalId = result.lastInsertRowid as number
  setGoalPrograms(goalId, data.program_ids ?? [])
  return getGoal(goalId)
}

export function updateGoal(id: number, data: Partial<any>): any {
  // program_ids is handled via the junction table, not a goals column
  const { program_ids, ...rest } = data

  const fields: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(rest)) {
    if (key !== 'id') {
      fields.push(`${key} = ?`)
      values.push(toSQLiteValue(value))
    }
  }

  if (fields.length === 0) {
    if (program_ids !== undefined) {
      setGoalPrograms(id, program_ids)
    }
    return getGoal(id)
  }

  values.push(id)
  db.prepare(`UPDATE goals SET ${fields.join(', ')} WHERE id = ?`).run(...values)

  if (program_ids !== undefined) {
    setGoalPrograms(id, program_ids)
  }

  return getGoal(id)
}

export function deleteGoal(id: number): void {
  db.prepare('DELETE FROM goals WHERE id = ?').run(id)
}

export function getGoalCompletions(goalId: number): any[] {
  return db
    .prepare(
      `
    SELECT * FROM goal_completions WHERE goal_id = ? ORDER BY date DESC
  `
    )
    .all(goalId)
}

export function addGoalCompletion(goalId: number, date: string, seconds: number): any {
  db.prepare(
    `
    INSERT INTO goal_completions (goal_id, date, achieved_seconds)
    VALUES (?, ?, ?)
    ON CONFLICT(goal_id, date) DO UPDATE SET
      achieved_seconds = ?
  `
  ).run(goalId, date, seconds, seconds)

  return db.prepare('SELECT * FROM goal_completions WHERE goal_id = ? AND date = ?').get(goalId, date)
}

// ==================== User Profile ====================

export function getUserProfile(): any {
  return db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
}

export function updateUserProfile(data: Partial<any>): any {
  const fields: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(data)) {
    if (key !== 'id') {
      fields.push(`${key} = ?`)
      values.push(toSQLiteValue(value))
    }
  }

  if (fields.length === 0) {
    return getUserProfile()
  }

  db.prepare(`UPDATE user_profile SET ${fields.join(', ')} WHERE id = 1`).run(...values)
  return db.prepare('SELECT * FROM user_profile WHERE id = 1').get()
}

// ==================== Data Management ====================

export function clearAllTrackingData(): void {
  db.exec('DELETE FROM usage_sessions')
  db.exec('DELETE FROM daily_usage')
  db.exec('DELETE FROM goal_completions')
  db.exec('DELETE FROM pomodoro_sessions')
  db.exec('UPDATE user_profile SET hearts_count = 0 WHERE id = 1')
}

// ==================== Pomodoro Sessions ====================

export function addPomodoroSession(data: {
  session_type: string
  planned_duration: number
  actual_duration: number
  completed: boolean
  start_time: string
  end_time: string
  date: string
}): any {
  const stmt = db.prepare(`
    INSERT INTO pomodoro_sessions (session_type, planned_duration, actual_duration, completed, start_time, end_time, date)
    VALUES (@session_type, @planned_duration, @actual_duration, @completed, @start_time, @end_time, @date)
  `)
  const result = stmt.run({
    session_type: data.session_type,
    planned_duration: data.planned_duration,
    actual_duration: data.actual_duration,
    completed: data.completed ? 1 : 0,
    start_time: data.start_time,
    end_time: data.end_time,
    date: data.date
  })
  return db.prepare('SELECT * FROM pomodoro_sessions WHERE id = ?').get(result.lastInsertRowid)
}

export function getPomodoroSessions(date?: string): any[] {
  if (date) {
    return db.prepare('SELECT * FROM pomodoro_sessions WHERE date = ? ORDER BY start_time DESC').all(date)
  }
  return db.prepare('SELECT * FROM pomodoro_sessions ORDER BY start_time DESC').all()
}

// ==================== Session Management ====================

export function getActiveSession(): any {
  return db.prepare('SELECT * FROM usage_sessions WHERE end_time IS NULL ORDER BY start_time DESC LIMIT 1').get()
}

export function endAllSessions(): void {
  const activeSessions: any[] = db
    .prepare('SELECT * FROM usage_sessions WHERE end_time IS NULL')
    .all()

  for (const session of activeSessions) {
    endSession(session.id)
  }
}

// ==================== Backup / Restore ====================

// Dependency order for import (parents before children) and its reverse for clear.
const BACKUP_INSERT_ORDER = [
  'programs',
  'user_profile',
  'goals',
  'goal_programs',
  'usage_sessions',
  'daily_usage',
  'goal_completions',
  'pomodoro_sessions'
]

/** Dumps every table's rows as an object keyed by table name. */
export function exportAllData(): Record<string, any[]> {
  const result: Record<string, any[]> = {}
  for (const table of BACKUP_INSERT_ORDER) {
    result[table] = db.prepare(`SELECT * FROM ${table}`).all()
  }
  return result
}

/**
 * Replaces ALL data with the provided rows. Runs in a single transaction so
 * either everything is restored or nothing changes.
 */
export function importAllData(data: Record<string, any[]>): void {
  const clearOrder = [...BACKUP_INSERT_ORDER].reverse()

  const tx = db.transaction(() => {
    for (const table of clearOrder) {
      db.exec(`DELETE FROM ${table}`)
    }
    for (const table of BACKUP_INSERT_ORDER) {
      const rows = data[table] || []
      for (const row of rows) {
        const columns = Object.keys(row)
        const colNames = columns.join(', ')
        const placeholders = columns.map(() => '?').join(', ')
        db.prepare(`INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`)
          .run(...columns.map((c) => toSQLiteValue(row[c])))
      }
    }
  })

  tx()
}
