import { app, BrowserWindow, shell, Menu, protocol } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabase, getUserProfile, localDate } from './database'
import { UsageTracker } from './tracker'
import { PomodoroEngine } from './pomodoro-engine'
import { registerIpcHandlers } from './ipc-handlers'
import { FloatingBallWindow } from './floating-ball-window'
import { TodoFloatingWindow } from './todo-floating-window'
import { setupTray, destroyTray, updateTrayMenu } from './tray'
import { setAutoStart } from './auto-launch'
import { checkGoalCompletion } from './ipc-handlers'
import { initReminderScheduler } from './reminder-scheduler'
import { setChatBubbleListener } from './notification'

// Custom scheme for local images. In dev the renderer is served from
// http://localhost, and Chromium refuses to render file:// images from that
// origin. Serving them through a privileged scheme works in both dev and prod.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'luo-file',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
  }
])

// Windows toast notifications need an explicit AppUserModelID. The packaged
// build must use the same id as the installer shortcut (electron-builder appId);
// in development the executable path is what Windows can map to.
if (process.platform === 'win32') {
  app.setAppUserModelId(app.isPackaged ? 'com.luo.app' : process.execPath)
}

let mainWindow: BrowserWindow | null = null
let tracker: UsageTracker | null = null
let pomodoro: PomodoroEngine | null = null
let floatingBall: FloatingBallWindow | null = null
let todoFloating: TodoFloatingWindow | null = null
let isQuitting = false

/**
 * Last date for which the end-of-day goal check has run. Initialized to
 * yesterday so a fresh start also evaluates the day that just ended.
 */
let lastGoalCheckDate = localDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

/**
 * Runs the end-of-day goal check for every fully elapsed day since the last
 * observed date. This is what lets restriction goals award a heart: they can
 * only be judged once the day is over and the user has stayed under the limit.
 */
function runElapsedDayChecks(): void {
  const today = localDate()
  if (today === lastGoalCheckDate) return

  // Wait a couple of minutes after midnight so the tracker has already ended
  // yesterday's in-flight session and written its usage to the database.
  const now = new Date()
  if (now.getHours() === 0 && now.getMinutes() < 2) return

  const cursor = new Date(`${lastGoalCheckDate}T00:00:00`)
  const end = new Date(`${today}T00:00:00`)
  let guard = 0

  // Cap the catch-up so a long shutdown doesn't rain a backlog of hearts.
  while (cursor < end && guard < 7) {
    const date = localDate(cursor)
    try {
      checkGoalCompletion(date)
    } catch (err) {
      console.error(`Failed to check goals for ${date}:`, err)
    }
    cursor.setDate(cursor.getDate() + 1)
    guard++
  }

  lastGoalCheckDate = today
}

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  // Second instance: focus existing window
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.setSkipTaskbar(false)
      mainWindow.show()
      mainWindow.focus()
    }
  })

  app.on('will-finish-launching', () => {
    // Register for macOS open-file/open-url events if needed
  })

  app.whenReady().then(() => {
    setup()
  })
}

function setup(): void {
  // Serve local images referenced by the renderer through luo-file://.
  protocol.handle('luo-file', async (request) => {
    try {
      // luo-file://local/C:/Users/... — the host is ignored, the pathname is
      // the real file path.
      const rawPath = decodeURIComponent(new URL(request.url).pathname)
      // Windows paths arrive as /C:/Users/...; strip the scheme's leading slash.
      const filePath =
        process.platform === 'win32' && /^\/[A-Za-z]:/.test(rawPath)
          ? rawPath.slice(1)
          : rawPath

      // Only serve files from the app's own user-data directory.
      const resolvedPath = path.resolve(filePath)
      const userDataRoot = path.resolve(app.getPath('userData'))
      const relative = path.relative(userDataRoot, resolvedPath)
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        return new Response('Forbidden', { status: 403 })
      }

      const ext = path.extname(resolvedPath).toLowerCase()
      const mimeTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml'
      }

      const data = await fs.promises.readFile(resolvedPath)
      return new Response(data, {
        headers: { 'content-type': mimeTypes[ext] || 'application/octet-stream' }
      })
    } catch (err) {
      console.error('Failed to serve local image:', request.url, err)
      return new Response('Not found', { status: 404 })
    }
  })

  // 1. Initialize database
  initDatabase()

  // Remove default app menu (File, Edit, View, etc.)
  Menu.setApplicationMenu(null)

  // electron-vite exposes ELECTRON_RENDERER_URL in dev; VITE_DEV_SERVER_URL
  // is kept for compatibility with older setups.
  const devServerUrl =
    process.env.ELECTRON_RENDERER_URL || process.env.VITE_DEV_SERVER_URL

  // 2. Create main window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    icon: getIconPath(),
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // 3. Load renderer
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // 4. Show window when ready
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show()
    }
  })

  // 5. Close behavior: hide to tray instead of quitting (remove from taskbar)
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      if (mainWindow) {
        mainWindow.hide()
        mainWindow.setSkipTaskbar(true) // Remove from taskbar when hidden
        updateTrayMenu(mainWindow)
      }
    }
  })

  // When showing, restore taskbar presence
  mainWindow.on('show', () => {
    if (mainWindow) {
      mainWindow.setSkipTaskbar(false)
    }
  })

  // 6. Initialize usage tracker
  tracker = new UsageTracker(mainWindow)
  tracker.onTick((liveProg) => {
    try {
      const today = localDate()
      checkGoalCompletion(today, liveProg)
    } catch {}
  })
  tracker.start()

  // 7. Initialize pomodoro engine
  pomodoro = new PomodoroEngine(mainWindow)

  // 8. Create floating ball window, pre-create window to avoid lag on first use,
  //    and sync enabled state from profile
  floatingBall = new FloatingBallWindow()
  floatingBall.create()
  try {
    const profile = getUserProfile()
    if (profile && profile.pomodoro_floating_ball_enabled) {
      floatingBall.setEnabled(true)
    }
    if (profile && profile.floating_ball_color) {
      floatingBall.setThemeColor(profile.floating_ball_color)
    } else if (profile && profile.theme_color) {
      floatingBall.setThemeColor(profile.theme_color)
    }
    if (profile) {
      floatingBall.setBallImage(profile.pomodoro_floating_ball_image)
      floatingBall.setBallMetrics(profile.pomodoro_ball_size, profile.pomodoro_ball_shape)
    }
  } catch (err) {
    console.error('Failed to sync floating ball state from profile:', err)
  }
  pomodoro.onTick((state) => {
    floatingBall?.handleTick(state)
  })

  // 9. Create the todo floating window instance (shown only if enabled).
  //    Register IPC handlers first so the window's page can query todos.
  todoFloating = new TodoFloatingWindow()
  registerIpcHandlers(mainWindow, tracker, pomodoro, floatingBall, todoFloating)

  // Mirror every system notification into the todo ball's chat bubble when
  // the user has enabled that option.
  setChatBubbleListener((title, body) => {
    return todoFloating ? todoFloating.notify(title, body) : false
  })

  // 9b. Restore the todo floating window + scheduled reminders
  try {
    const profile = getUserProfile()
    if (profile) {
      todoFloating.setBallImage(profile.todo_floating_ball_image)
      todoFloating.setBallMetrics(profile.todo_ball_size, profile.todo_ball_shape)
      todoFloating.setChatNotificationsEnabled(!!profile.todo_floating_chat_notifications)
      if (profile.todo_floating_enabled) {
        todoFloating.setEnabled(true, profile.theme_color)
      }
    }
  } catch (err) {
    console.error('Failed to restore todo floating window state:', err)
  }

  initReminderScheduler(
    () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('reminders:changed')
      }
    },
    (title) => {
      if (!mainWindow || mainWindow.isDestroyed()) return
      // In-app fallback so the reminder is visible even when the OS
      // notification is suppressed by Windows notification settings.
      mainWindow.webContents.send('reminder:fired', title)
      if (!mainWindow.isFocused()) {
        mainWindow.flashFrame(true)
      }
    }
  )

  // 10. Setup tray
  setupTray(mainWindow)

  // 11. Apply auto-start from saved profile
  // Always write on startup to fix stale dev-mode login items
  // (dev mode registers electron.exe which opens a blank window)
  try {
    const profile = getUserProfile()
    if (profile) {
      setAutoStart(!!profile.auto_start)
    }
  } catch (err) {
    console.error('Failed to sync auto-start setting:', err)
  }

  // 12. End-of-day goal check: evaluate the day that just ended so
  //     restriction goals can award a heart after staying under the limit.
  runElapsedDayChecks()

  // 13. Periodic fallback goal check (every 60s as backup)
  //     Primary check happens on every tracking tick (~3s)
  setInterval(() => {
    try {
      // Detect a calendar-day change and settle the day that has ended.
      runElapsedDayChecks()
      checkGoalCompletion(localDate())
    } catch (err) {
      console.error('Failed to check goal completions:', err)
    }
  }, 60000)

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// before-quit: stop tracker and pomodoro
app.on('before-quit', () => {
  isQuitting = true

  if (tracker) {
    tracker.stop()
    tracker = null
  }

  if (pomodoro) {
    pomodoro.destroy()
    pomodoro = null
  }

  if (floatingBall) {
    floatingBall.destroy()
    floatingBall = null
  }

  if (todoFloating) {
    todoFloating.destroy()
    todoFloating = null
  }

  destroyTray()
  mainWindow = null
})

// window-all-closed: don't quit (app lives in tray)
app.on('window-all-closed', () => {
  // On macOS it's common to keep the app in the dock
  // On Windows, we keep it in the tray
})

app.on('activate', () => {
  // macOS: re-create window when dock icon clicked
  if (!mainWindow) {
    setup()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
})

/**
 * Returns the path to the app icon, searching multiple possible locations.
 */
function getIconPath(): string {
  const possiblePaths: string[] = []

  if (app.isPackaged) {
    possiblePaths.push(path.join(process.resourcesPath || '', 'icon.ico'))
    possiblePaths.push(path.join(process.resourcesPath || '', 'icon.png'))
  } else {
    possiblePaths.push(path.join(__dirname, '../../resources/icon.ico'))
    possiblePaths.push(path.join(__dirname, '../../resources/icon.png'))
    possiblePaths.push(path.join(__dirname, '../resources/icon.ico'))
    possiblePaths.push(path.join(__dirname, '../resources/icon.png'))
  }

  for (const iconPath of possiblePaths) {
    try {
      if (fs.existsSync(iconPath)) {
        return iconPath
      }
    } catch {
      // Continue
    }
  }

  return ''
}
