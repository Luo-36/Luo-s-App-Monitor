import { app, BrowserWindow, shell, Menu } from 'electron'
import path from 'path'
import fs from 'fs'
import { initDatabase, getUserProfile, localDate } from './database'
import { UsageTracker } from './tracker'
import { PomodoroEngine } from './pomodoro-engine'
import { registerIpcHandlers } from './ipc-handlers'
import { FloatingBallWindow } from './floating-ball-window'
import { setupTray, destroyTray, updateTrayMenu } from './tray'
import { setAutoStart } from './auto-launch'
import { checkGoalCompletion } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let tracker: UsageTracker | null = null
let pomodoro: PomodoroEngine | null = null
let floatingBall: FloatingBallWindow | null = null
let isQuitting = false

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
  // 1. Initialize database
  initDatabase()

  // Remove default app menu (File, Edit, View, etc.)
  Menu.setApplicationMenu(null)

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
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
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
  } catch (err) {
    console.error('Failed to sync floating ball state from profile:', err)
  }
  pomodoro.onTick((state) => {
    floatingBall?.handleTick(state)
  })

  // 9. Register IPC handlers (pass floatingBall for toggle support)
  registerIpcHandlers(mainWindow, tracker, pomodoro, floatingBall)

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

  // 12. Periodic fallback goal check (every 60s as backup)
  //     Primary check happens on every tracking tick (~3s)
  setInterval(() => {
    try {
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
