import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'path'
import fs from 'fs'
import { execFile } from 'child_process'
import { UsageTracker } from './tracker'
import { PomodoroEngine } from './pomodoro-engine'
import { FloatingBallWindow } from './floating-ball-window'
import {
  getPrograms,
  getProgram,
  addProgram,
  updateProgram,
  deleteProgram,
  getTodayUsage,
  getTotalUsage,
  getProgramUsage,
  getGoals,
  getGoal,
  addGoal,
  updateGoal,
  deleteGoal,
  getGoalCompletions,
  addGoalCompletion,
  getUserProfile,
  updateUserProfile,
  getProgramUsageForDate,
  getTotalUsageForDate,
  clearAllTrackingData
} from './database'
import { setAutoStart, isAutoStartEnabled } from './auto-launch'
import { saveImageFromBase64, deleteImageFile, getImagePath, getImageDir, ensureImageDir } from './image-helper'
import { sendNotification } from './notification'

let mainWindowRef: BrowserWindow

/** Track which restriction goals have already triggered a warning today (goalId:date → true) */
const warnedRestrictions = new Set<string>()

export function registerIpcHandlers(
  mainWindow: BrowserWindow,
  tracker: UsageTracker,
  pomodoro: PomodoroEngine,
  floatingBall?: FloatingBallWindow
): void {
  mainWindowRef = mainWindow
  // ==================== Programs ====================

  ipcMain.handle('program:add', (_event, data) => {
    return addProgram(data)
  })

  ipcMain.handle('program:update', (_event, id: number, data) => {
    return updateProgram(id, data)
  })

  ipcMain.handle('program:delete', (_event, id: number) => {
    deleteProgram(id)
    tracker.updateProcessCache()
  })

  ipcMain.handle('program:getAll', () => {
    return getPrograms()
  })

  ipcMain.handle('program:get', (_event, id: number) => {
    return getProgram(id)
  })

  // ==================== Usage Tracking ====================

  ipcMain.handle('usage:getToday', () => {
    return getTodayUsage()
  })

  ipcMain.handle('usage:getTotal', () => {
    return getTotalUsage()
  })

  ipcMain.handle('usage:getProgram', (_event, programId: number, range: '7d' | '30d') => {
    return getProgramUsage(programId, range)
  })

  // ==================== Goals ====================

  ipcMain.handle('goal:add', (_event, data) => {
    return addGoal(data)
  })

  ipcMain.handle('goal:update', (_event, id: number, data) => {
    return updateGoal(id, data)
  })

  ipcMain.handle('goal:delete', (_event, id: number) => {
    deleteGoal(id)
  })

  ipcMain.handle('goal:getAll', () => {
    return getGoals()
  })

  ipcMain.handle('goal:get', (_event, id: number) => {
    return getGoal(id)
  })

  ipcMain.handle('goal:checkCompletion', (_event, date: string) => {
    return checkGoalCompletion(date)
  })

  ipcMain.handle('goal:getCompletions', (_event, goalId: number) => {
    return getGoalCompletions(goalId)
  })

  // ==================== Profile ====================

  ipcMain.handle('profile:get', () => {
    return getUserProfile()
  })

  ipcMain.handle('profile:update', async (_event, data) => {
    try {
      const result = updateUserProfile(data)
      // Sync floating ball theme color when theme changes
      if (floatingBall && data.pomodoro_floating_ball_image !== undefined) {
        // no-op: floating ball no longer uses custom images
      }
      if (floatingBall && data.floating_ball_color !== undefined) {
        floatingBall.setThemeColor(data.floating_ball_color)
      } else if (floatingBall && data.theme_color !== undefined) {
        floatingBall.setThemeColor(data.theme_color)
      }
      if (floatingBall && data.pomodoro_floating_ball_enabled !== undefined) {
        floatingBall.setEnabled(!!data.pomodoro_floating_ball_enabled)
      }
      return result
    } catch (err) {
      console.error('Failed to update profile:', err)
      throw err
    }
  })

  // ==================== Settings ====================

  ipcMain.handle('settings:setAutoStart', (_event, enabled: boolean) => {
    setAutoStart(enabled)
  })

  ipcMain.handle('settings:getAutoStart', () => {
    return isAutoStartEnabled()
  })

  ipcMain.handle('data:clearAll', () => {
    clearAllTrackingData()
    // Notify renderer to refresh profile (hearts reset)
    if (mainWindowRef && !mainWindowRef.isDestroyed()) {
      mainWindowRef.webContents.send('profile:updated', { hearts_count: 0 })
    }
  })

  // ==================== File Dialog ====================

  ipcMain.handle('dialog:openFile', async (_event, filters?: { name: string; extensions: string[] }[]) => {
    const defaultFilters: { name: string; extensions: string[] }[] = [
      { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico'] },
      { name: 'All Files', extensions: ['*'] }
    ]

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: filters || defaultFilters
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // ==================== File Helpers ====================

  ipcMain.handle('file:readBase64', async (_event, filePath: string) => {
    try {
      const data = fs.readFileSync(filePath)
      const ext = path.extname(filePath).slice(1).toLowerCase() || 'png'
      const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`
      return `data:${mime};base64,${data.toString('base64')}`
    } catch (err) {
      console.error('Failed to read file as base64:', err)
      return null
    }
  })

  ipcMain.handle('image:crop', async (_event, sourcePath: string, outputName: string, x: number, y: number, w: number, h: number) => {
    try {
      ensureImageDir('background')
      const ext = path.extname(sourcePath) || '.png'
      const outPath = path.join(getImageDir('background'), outputName + ext)
      // Use PowerShell with System.Drawing to crop (reliable, no deps needed)
      const ps = `
Add-Type -AssemblyName System.Drawing
try {
  $img = [System.Drawing.Image]::FromFile('${sourcePath.replace(/'/g, "''")}')
  $crop = New-Object System.Drawing.Rectangle(${x}, ${y}, ${w}, ${h})
  $bmp = $img.Clone($crop, $img.PixelFormat)
  $bmp.Save('${outPath.replace(/'/g, "''")}', [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose(); $img.Dispose()
  Write-Output "OK"
} catch { Write-Output "ERR:$_" }
`
      const result = await new Promise<string>((resolve) => {
        execFile('powershell', ['-NoProfile', '-Command', ps], { timeout: 15000 }, (e: any, so: string) => {
          resolve(e ? 'ERR:' + e.message : so.trim())
        })
      })
      if (result === 'OK' && fs.existsSync(outPath)) return outPath
      console.error('Image crop failed:', result)
      return null
    } catch (err) {
      console.error('Image crop error:', err)
      return null
    }
  })

  // ==================== Images ====================

  ipcMain.handle('image:save', async (_event, base64Data: string, folder: string, fileName: string) => {
    return await saveImageFromBase64(base64Data, folder, fileName)
  })

  ipcMain.handle('image:delete', async (_event, fileName: string) => {
    await deleteImageFile(fileName)
  })

  ipcMain.handle('image:getPath', (_event, fileName: string) => {
    return getImagePath(fileName)
  })

  ipcMain.handle('image:saveBackground', async (_event, filePath: string) => {
    try {
      const userDataPath = app.getPath('userData')
      // If already inside userData, just return as-is
      if (filePath.startsWith(userDataPath)) {
        return filePath
      }

      const bgDir = path.join(userDataPath, 'images', 'background')
      if (!fs.existsSync(bgDir)) {
        fs.mkdirSync(bgDir, { recursive: true })
      }
      const ext = path.extname(filePath) || '.png'
      const uniqueName = `bg_${Date.now()}${ext}`
      const destPath = path.join(bgDir, uniqueName)
      fs.copyFileSync(filePath, destPath)
      return destPath
    } catch (err) {
      console.error('Failed to save background image:', err)
      return null
    }
  })

  // ==================== Icon Extraction ====================

  ipcMain.handle('icon:extractFromExe', async (_event, exePath: string) => {
    try {
      const iconsDir = path.join(app.getPath('userData'), 'images', 'icons')
      ensureImageDir('icons')

      const exeName = path.basename(exePath, '.exe').replace(/[^a-zA-Z0-9_一-鿿]/g, '_')
      const outputFileName = `exe_${exeName}_${Date.now()}.png`
      const outputPath = path.join(iconsDir, outputFileName)

      // Escape single quotes for PowerShell string literals
      const safeExePath = exePath.replace(/'/g, "''")
      const safeOutputPath = outputPath.replace(/'/g, "''")

      const psScript = `
Add-Type -AssemblyName System.Drawing
try {
  $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${safeExePath}')
  if ($icon -ne $null) {
    $bitmap = $icon.ToBitmap()
    $bitmap.Save('${safeOutputPath}', [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    $icon.Dispose()
    Write-Output "SUCCESS"
  } else {
    Write-Output "NULL_ICON"
  }
} catch {
  Write-Output "ERROR"
}
`.trim()

      return await new Promise<string | null>((resolve) => {
        execFile('powershell', ['-NoProfile', '-Command', psScript], { timeout: 15000 }, (error, stdout) => {
          if (error) {
            console.error('PowerShell icon extraction failed:', error)
            resolve(null)
            return
          }
          const output = stdout.trim()
          if (output === 'SUCCESS' && fs.existsSync(outputPath)) {
            resolve(outputPath)
          } else {
            resolve(null)
          }
        })
      })
    } catch (err) {
      console.error('Icon extraction error:', err)
      return null
    }
  })

  // ==================== Pomodoro ====================

  ipcMain.handle('pomodoro:start', (_event, config) => {
    pomodoro.start(config)
  })

  ipcMain.handle('pomodoro:pause', () => {
    pomodoro.pause()
  })

  ipcMain.handle('pomodoro:resume', () => {
    pomodoro.resume()
  })

  ipcMain.handle('pomodoro:stop', () => {
    pomodoro.stop()
  })

  ipcMain.handle('pomodoro:getState', () => {
    return pomodoro.getState()
  })

  // ==================== Floating Ball ====================

  ipcMain.handle('floatingball:toggle', (_event, enabled: boolean) => {
    if (!floatingBall) return false
    floatingBall.setEnabled(enabled)
    return floatingBall.getEnabled()
  })

  ipcMain.handle('floatingball:getState', () => {
    return floatingBall ? floatingBall.getEnabled() : false
  })
}

/**
 * Checks all goals against usage for the given date and records completions.
 * For achievement goals: marks complete and awards a heart when the user meets or exceeds the limit.
 * For restriction goals: sends a warning when the user exceeds the limit;
 * marks completion at end-of-day (past date) if the user stayed under the limit (no heart awarded).
 */
/**
 * @param date Date string YYYY-MM-DD to check
 * @param liveCurrent Optional live session data to add to daily_usage for real-time checking
 */
export function checkGoalCompletion(
  date: string,
  liveCurrent?: { programId: number; elapsedSeconds: number } | null
): void {
  const mw = mainWindowRef
  const goals: any[] = getGoals()
  const todayStr = new Date().toISOString().slice(0, 10)
  const isToday = date === todayStr

  for (const goal of goals) {
    if (!goal.is_active) continue

    const goalType: string = goal.goal_type || 'achievement'
    let achievedSeconds = 0

    if (goal.program_id) {
      // Goal is tied to a specific program
      if (isToday) {
        const usage: any[] = getTodayUsage()
        const programUsage = usage.find((u: any) => u.program_id === goal.program_id)
        achievedSeconds = programUsage ? programUsage.total_seconds : 0
        // Add live elapsed time if this program is currently being tracked
        if (liveCurrent && liveCurrent.programId === goal.program_id) {
          achievedSeconds += liveCurrent.elapsedSeconds
        }
      } else {
        achievedSeconds = getProgramUsageForDate(goal.program_id, date)
      }
    } else {
      // Goal is for total usage across all programs
      if (isToday) {
        const usage: any[] = getTodayUsage()
        achievedSeconds = usage.reduce((sum: number, u: any) => sum + u.total_seconds, 0)
        // Add live elapsed time of the current session
        if (liveCurrent) {
          achievedSeconds += liveCurrent.elapsedSeconds
        }
      } else {
        achievedSeconds = getTotalUsageForDate(date)
      }
    }

    // Check if already completed for this date
    const completions: any[] = getGoalCompletions(goal.id)
    const alreadyCompleted = completions.some((c: any) => c.date === date)

    if (goalType === 'achievement') {
      // Achievement: user must meet or exceed the limit
      if (achievedSeconds >= goal.daily_limit_seconds && !alreadyCompleted) {
        addGoalCompletion(goal.id, date, achievedSeconds)

        // Award a heart
        const profile = getUserProfile()
        if (profile) {
          updateUserProfile({ hearts_count: (profile.hearts_count || 0) + 1 })
          // Notify renderer to update UI
          try { mw.webContents.send('profile:updated', { hearts_count: profile.hearts_count + 1 }) } catch {}
        }

        // Congratulations notification
        sendNotification(
          `目标达成: ${goal.name}`,
          `恭喜! 你已完成今日目标 ${Math.round(goal.daily_limit_seconds / 60)} 分钟!`,
          () => {
            if (!mw.isDestroyed()) {
              mw.show()
              mw.focus()
              mw.webContents.send('goal:reminder', goal)
            }
          }
        )
      }
    } else if (goalType === 'restriction') {
      // Restriction: user must stay under the limit
      if (achievedSeconds >= goal.daily_limit_seconds) {
        // Exceeded limit — send warning notification ONCE per goal per day
        const warnKey = `${goal.id}:${date}`
        if (!warnedRestrictions.has(warnKey)) {
          warnedRestrictions.add(warnKey)
          const exceededMinutes = Math.round((achievedSeconds - goal.daily_limit_seconds) / 60)
          sendNotification(
            `目标超限警告: ${goal.name}`,
            `注意! ${goal.name} 已超出限制 ${exceededMinutes} 分钟!`,
            () => {
              if (!mw.isDestroyed()) {
                mw.show()
                mw.focus()
              }
            }
          )
        }
      } else if (!isToday && !alreadyCompleted) {
        // End-of-day check (past date): user stayed under limit — mark completion + award heart
        addGoalCompletion(goal.id, date, achievedSeconds)
        const profile = getUserProfile()
        if (profile) {
          updateUserProfile({ hearts_count: (profile.hearts_count || 0) + 1 })
          try { mw.webContents.send('profile:updated', { hearts_count: profile.hearts_count + 1 }) } catch {}
        }

        sendNotification(
          `目标完成: ${goal.name}`,
          `昨日你的 ${goal.name} 使用时长未超限，成功完成目标! 获得一颗♥`,
          () => {
            if (!mw.isDestroyed()) {
              mw.show()
              mw.focus()
            }
          }
        )
      }
    }
  }
}
