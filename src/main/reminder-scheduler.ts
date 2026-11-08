import { getReminders, getReminder, deleteReminder } from './database'
import { sendNotification } from './notification'

/** Max delay a single setTimeout can hold (~24.8 days). Longer waits are re-armed. */
const MAX_TIMEOUT = 2147483647

const timers = new Map<number, NodeJS.Timeout>()
let onChanged: (() => void) | null = null
let onFired: ((title: string) => void) | null = null

/**
 * Loads persisted reminders from the database and schedules them.
 * Should be called once on app startup.
 *
 * @param onRemindersChanged Called whenever a reminder fires or is removed by
 *        the scheduler, so the UI can refresh its list.
 * @param onReminderFired Called with the reminder title when one fires, so the
 *        renderer can show an in-app fallback notification.
 */
export function initReminderScheduler(
  onRemindersChanged?: () => void,
  onReminderFired?: (title: string) => void
): void {
  onChanged = onRemindersChanged || null
  onFired = onReminderFired || null
  rescheduleAll()
}

/** Schedules (or re-schedules) a single reminder. */
export function addReminderSchedule(reminder: { id: number; title: string; remind_at: number }): void {
  arm(reminder.id, reminder.title, reminder.remind_at)
}

/** Cancels the pending timer for a reminder (does not touch the database). */
export function cancelReminder(id: number): void {
  const timeout = timers.get(id)
  if (timeout) {
    clearTimeout(timeout)
    timers.delete(id)
  }
}

/** Clears every timer and schedules all reminders currently in the database. */
export function rescheduleAll(): void {
  for (const timeout of timers.values()) {
    clearTimeout(timeout)
  }
  timers.clear()

  for (const reminder of getReminders()) {
    arm(reminder.id, reminder.title, reminder.remind_at)
  }
}

function arm(id: number, title: string, remindAt: number): void {
  const existing = timers.get(id)
  if (existing) clearTimeout(existing)

  const delay = remindAt - Date.now()

  if (delay <= 0) {
    // Overdue (e.g. the app was closed when it should have fired) — notify now.
    fire(id, title, true)
    return
  }

  const timeout = setTimeout(() => {
    timers.delete(id)
    if (Date.now() >= remindAt) {
      fire(id, title, false)
    } else {
      // Timeout was capped (very long reminder) — keep waiting.
      arm(id, title, remindAt)
    }
  }, Math.min(delay, MAX_TIMEOUT))

  timers.set(id, timeout)
}

function fire(id: number, fallbackTitle: string, overdue: boolean): void {
  const reminder = getReminder(id)
  if (!reminder) {
    timers.delete(id)
    return
  }

  deleteReminder(id)
  timers.delete(id)

  const body = overdue
    ? `${reminder.title}（原定 ${formatDateTime(reminder.remind_at)}，补发提醒）`
    : reminder.title

  sendNotification('提醒', body || fallbackTitle)

  try {
    onChanged?.()
  } catch (err) {
    console.error('[reminder-scheduler] Failed to notify change listener:', err)
  }

  try {
    onFired?.(reminder.title)
  } catch (err) {
    console.error('[reminder-scheduler] Failed to notify fired listener:', err)
  }
}

function formatDateTime(epochMs: number): string {
  const d = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
