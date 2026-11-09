import { Notification } from 'electron'

const scheduledReminders: NodeJS.Timeout[] = []

/**
 * Keep references to visible notifications until they close. On some
 * platforms a Notification that is garbage-collected right after show()
 * can be silently dropped before the OS displays it.
 */
const activeNotifications = new Set<Notification>()

/**
 * Optional replacement channel (e.g. the todo floating ball's chat bubble).
 * Returning true means the bubble displayed the notification, in which case
 * the native system notification is skipped (the two are mutually exclusive).
 */
let chatBubbleListener: ((title: string, body: string) => boolean) | null = null

export function setChatBubbleListener(
  listener: ((title: string, body: string) => boolean) | null
): void {
  chatBubbleListener = listener
}

/**
 * Sends a system notification to the user.
 * @param title Notification title
 * @param body Notification body text
 * @param onClick Optional callback when the notification is clicked
 */
export function sendNotification(title: string, body: string, onClick?: () => void): void {
  // If the chat bubble channel is active it *replaces* the native
  // notification (mutually exclusive, as requested).
  let shownInChatBubble = false
  try {
    shownInChatBubble = chatBubbleListener?.(title, body) ?? false
  } catch (err) {
    console.error('[notification] Chat bubble listener failed:', err)
  }

  if (shownInChatBubble) {
    return
  }

  if (!Notification.isSupported()) {
    console.warn('[notification] System notifications are not supported on this platform')
    return
  }

  try {
    const notification = new Notification({
      title,
      body,
      silent: false
    })

    activeNotifications.add(notification)

    const cleanup = (): void => {
      activeNotifications.delete(notification)
    }
    notification.on('close', cleanup)
    notification.on('failed', cleanup)

    if (onClick) {
      notification.on('click', onClick)
    }

    notification.show()

    // Safety net: never keep a reference forever.
    setTimeout(cleanup, 60000)
  } catch (err) {
    console.error('[notification] Failed to show notification:', err)
  }
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
