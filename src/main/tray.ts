import { BrowserWindow, Tray, Menu, nativeImage, app } from 'electron'
import path from 'path'

let trayInstance: Tray | null = null

/**
 * Creates a simple colored tray icon from scratch.
 * Generates a 16x16 PNG with a solid color since we may not have real icon files.
 */
export function createTrayIcon(): Electron.NativeImage {
  // Try to load from app resources first
  const possiblePaths = [
    path.join(__dirname, '../../resources/icon.ico'),
    path.join(__dirname, '../../resources/icon.png'),
    path.join(__dirname, '../resources/icon.ico'),
    path.join(__dirname, '../resources/icon.png'),
    path.join(process.resourcesPath || '', 'icon.ico'),
    path.join(process.resourcesPath || '', 'icon.png')
  ]

  for (const iconPath of possiblePaths) {
    try {
      const img = nativeImage.createFromPath(iconPath)
      if (!img.isEmpty()) {
        return img.resize({ width: 16, height: 16 })
      }
    } catch {
      // Continue to next path
    }
  }

  // Fallback: generate a 16x16 colored icon programmatically
  // Create a simple colored PNG using raw pixel data
  const size = 16
  const buffer = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4
      // Draw a filled circle with indigo color (#6366f1)
      const cx = size / 2 - 0.5
      const cy = size / 2 - 0.5
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      const radius = size / 2 - 1

      if (dist <= radius) {
        buffer[offset] = 99    // R
        buffer[offset + 1] = 102 // G
        buffer[offset + 2] = 241 // B
        buffer[offset + 3] = 255 // A
      } else {
        buffer[offset] = 0
        buffer[offset + 1] = 0
        buffer[offset + 2] = 0
        buffer[offset + 3] = 0
      }
    }
  }

  const img = nativeImage.createFromBuffer(buffer, { width: size, height: size })
  return img
}

/**
 * Sets up the system tray icon and context menu.
 * @param mainWindow The main BrowserWindow to control
 * @returns The created Tray instance
 */
export function setupTray(mainWindow: BrowserWindow): Tray {
  if (trayInstance) {
    trayInstance.destroy()
  }

  const icon = createTrayIcon()
  const tray = new Tray(icon)
  trayInstance = tray

  tray.setToolTip('Luo - App Usage Monitor')

  // Double-click toggles window visibility
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })

  updateTrayMenu(mainWindow, tray)

  return tray
}

/**
 * Updates the tray context menu.
 */
export function updateTrayMenu(mainWindow: BrowserWindow, tray?: Tray): void {
  const t = tray || trayInstance
  if (!t) return

  const isVisible = mainWindow.isVisible()

  const contextMenu = Menu.buildFromTemplate([
    {
      label: isVisible ? 'Hide Window' : 'Show Window',
      click: () => {
        if (isVisible) {
          mainWindow.hide()
        } else {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit()
      }
    }
  ])

  t.setContextMenu(contextMenu)
}

/**
 * Destroys the tray instance (call on app quit).
 */
export function destroyTray(): void {
  if (trayInstance) {
    trayInstance.destroy()
    trayInstance = null
  }
}
