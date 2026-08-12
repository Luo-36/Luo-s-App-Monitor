import { Notification } from 'electron'

const scheduledReminders: NodeJS.Timeout[] = []

/**
 * Sends a system notification to the user.
 * @param title Notification title
 * @param body Notification body text
 * @param onClick Optional callback when the notification is clicked
 */
export function sendNotification(title: string, body: string, onClick?: () => void): void {
  const notification = new Notification({
    title,
    body,
    silent: false
  })

  if (onClick) {
    notification.on('click', onClick)
  }

  notification.show()
}

/**
 * Schedules a goal reminder notification based on the goal's remind_time.
 * Calculates the next occurrence of remind_time HH:MM and schedules a callback.
 * @param goal The goal object with remind_time in HH:MM format
 * @param callback Function to call when the reminder fires
 * @returns The timeout reference for the scheduled reminder
 */
export function scheduleGoalReminder(goal: { id: number; name: string; remind_time: string | null }, callback: () => void): NodeJS.Timeout | null {
  if (!goal.remind_time) return null

  const [hours, minutes] = goal.remind_time.split(':').map(Number)
  if (isNaN(hours) || isNaN(minutes)) return null

  const now = new Date()
  const scheduled = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    hours,
    minutes,
    0,
    0
  )

  // If the time has passed today, schedule for tomorrow
  if (scheduled <= now) {
    scheduled.setDate(scheduled.getDate() + 1)
  }

  const delayMs = scheduled.getTime() - now.getTime()

  const timeout = setTimeout(() => {
    sendNotification(
      `Goal Reminder: ${goal.name}`,
      `Don't forget your usage goal for today!`
    )
    callback()
  }, delayMs)

  scheduledReminders.push(timeout)

  return timeout
}

/**
 * Clears all scheduled reminder timeouts.
 */
export function clearScheduledReminders(): void {
  for (const reminder of scheduledReminders) {
    clearTimeout(reminder)
  }
  scheduledReminders.length = 0
}
