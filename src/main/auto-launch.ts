import { app } from 'electron'
import { execSync } from 'child_process'

/**
 * Remove ALL Electron auto-start entries from the Windows Run registry key.
 *
 * Electron writes entries under the "electron.app.<name>" key on Windows.
 * Across dev (app.name = "Electron") and different packaged versions
 * (app.name from package.json vs productName from electron-builder),
 * the key name can vary, causing:
 *  - Stale dev entries pointing to electron.exe (blank window on boot)
 *  - Duplicate entries from old installs (app launches twice)
 *
 * We clean everything starting with "electron.app." so that the subsequent
 * setLoginItemSettings call creates exactly one correct entry.
 *
 * Uses PowerShell because reg.exe output encoding is unreliable with CJK.
 */
function cleanAllElectronEntries(): void {
  try {
    // PowerShell script: enumerate Run key properties, delete any starting with "electron.app."
    const psScript = [
      '$run = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run"',
      '$props = Get-ItemProperty -Path $run -ErrorAction SilentlyContinue',
      'if ($props) {',
      '  $props.PSObject.Properties | ForEach-Object {',
      '    if ($_.Name -like "electron.app.*") {',
      '      Write-Output ("REMOVING:" + $_.Name)',
      '      Remove-ItemProperty -Path $run -Name $_.Name -Force -ErrorAction SilentlyContinue',
      '    }',
      '  }',
      '}',
      'Write-Output "DONE"'
    ].join('\n')

    const output = execSync(
      `powershell -NoProfile -NonInteractive -Command "${psScript.replace(/"/g, '\\"')}"`,
      { encoding: 'utf-8', timeout: 10000 }
    )
    console.log('[auto-launch]', output.trim())
  } catch (err) {
    console.log('[auto-launch] Cleanup error (may be harmless):', String(err).slice(0, 80))
  }
}

/**
 * Enables or disables auto-start (login item) for the app.
 *
 * IMPORTANT: Only works in production (packaged). In dev mode, process.execPath
 * points to electron.exe which cannot run the app standalone, so we ignore
 * auto-start requests to avoid creating bad registry entries.
 *
 * @param enabled Whether the app should start on login
 */
export function setAutoStart(enabled: boolean): void {
  if (!app.isPackaged) {
    return
  }

  // Remove ALL old electron.app.* entries before writing the correct one
  cleanAllElectronEntries()

  app.setLoginItemSettings({
    openAtLogin: enabled,
    args: []
  })
}

/**
 * Checks whether the app is configured to auto-start on login.
 * In dev mode, always returns false — dev never touches login items.
 * @returns true if auto-start is enabled
 */
export function isAutoStartEnabled(): boolean {
  if (!app.isPackaged) return false
  return app.getLoginItemSettings().openAtLogin
}
