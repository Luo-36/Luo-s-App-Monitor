import { spawn, exec, ChildProcess } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

/**
 * Generates the PowerShell script that:
 * 1. Compiles a C# type (ActiveWin) to call Win32 GetForegroundWindow API
 * 2. Runs a continuous loop checking the active window every 1 second
 * 3. Outputs the process name to stdout each iteration
 *    (empty string means no foreground window)
 */
function getPowerShellScript(): string {
  return `
Add-Type @"
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
public class ActiveWin {
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern int GetWindowThreadProcessId(IntPtr h, out int p);
    public static string Get() {
        IntPtr h = GetForegroundWindow();
        if (h == IntPtr.Zero) return "";
        int pid;
        GetWindowThreadProcessId(h, out pid);
        try { var proc = Process.GetProcessById(pid); return proc.ProcessName + ".exe"; }
        catch { return ""; }
    }
}
"@ | Out-Null
# Output immediately, THEN enter the loop
$result = [ActiveWin]::Get()
Write-Output $result
while($true) {
    Start-Sleep -Milliseconds 1000
    $result = [ActiveWin]::Get()
    Write-Output $result
}
`
}

/**
 * Monitors the active (foreground) window on Windows using a single long-running
 * PowerShell child process. Eliminates the overhead of spawning a new PowerShell
 * process every poll interval.
 *
 * The PowerShell process:
 * - Compiles the C# ActiveWin type once at startup
 * - Loops every 1 second calling GetForegroundWindow
 * - Writes the process name (or empty string) to stdout each iteration
 * - Node.js reads stdout line by line and invokes registered callbacks
 */
export class ActiveWindowMonitor {
  private process: ChildProcess | null = null
  private callbacks: Array<(processName: string) => void> = []
  private failedCallbacks: Array<() => void> = []
  private buffer: string = ''
  private restartTimer: NodeJS.Timeout | null = null
  private shouldRestart: boolean = false

  /**
   * Register a callback invoked ~every 1s with the active window's process name.
   * An empty string means no foreground window is detected.
   */
  onProcessChange(callback: (processName: string) => void): void {
    this.callbacks.push(callback)
  }

  /**
   * Register a callback invoked when the PowerShell process exits unexpectedly
   * (non-zero exit code or process error). The caller can use this to fall back
   * to an alternative monitor strategy.
   */
  onFailed(callback: () => void): void {
    this.failedCallbacks.push(callback)
  }

  /**
   * Start the long-running PowerShell child process.
   */
  start(): void {
    if (this.process) return
    this.shouldRestart = true
    console.log('[ActiveWindowMonitor] Starting PowerShell monitor...')
    this.spawnProcess()
  }

  private spawnProcess(): void {
    const script = getPowerShellScript()

    this.process = spawn('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script
    ], {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    })

    console.log('[ActiveWindowMonitor] PowerShell process spawned')

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      const lines = this.buffer.split('\n')
      // Keep the last (potentially incomplete) line in the buffer
      this.buffer = lines.pop() || ''
      for (const line of lines) {
        // Handle both \r\n (Windows) and \n line endings
        const trimmed = line.replace('\r', '').trim()
        for (const cb of this.callbacks) {
          cb(trimmed)
        }
      }
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      const text = data.toString()
      // Log errors but don't restart on stderr alone (compilation warnings, etc.)
      if (
        text.toLowerCase().includes('error') ||
        text.toLowerCase().includes('exception')
      ) {
        console.error('[ActiveWindowMonitor] PowerShell stderr:', text)
      }
    })

    this.process.on('exit', (code, signal) => {
      console.log(
        `[ActiveWindowMonitor] PowerShell exited (code: ${code}, signal: ${signal})`
      )
      this.process = null
      if (this.shouldRestart) {
        // Notify failure callbacks on unexpected exits (non-zero or signal)
        if (code !== 0 || signal) {
          console.log('[ActiveWindowMonitor] Notifying failure callbacks (unexpected exit)')
          this.failedCallbacks.forEach(cb => cb())
        }
        this.scheduleRestart()
      }
    })

    this.process.on('error', (err) => {
      console.error('[ActiveWindowMonitor] PowerShell process error:', err)
      this.process = null
      if (this.shouldRestart) {
        console.log('[ActiveWindowMonitor] Notifying failure callbacks (process error)')
        this.failedCallbacks.forEach(cb => cb())
        this.scheduleRestart()
      }
    })
  }

  private scheduleRestart(): void {
    if (this.restartTimer) return
    console.log('[ActiveWindowMonitor] Restarting PowerShell in 2 seconds...')
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      if (this.shouldRestart) {
        this.spawnProcess()
      }
    }, 2000)
  }

  /**
   * Stop the monitor and kill the PowerShell child process.
   * Callbacks are preserved so start() can be called again.
   */
  stop(): void {
    console.log('[ActiveWindowMonitor] Stopping monitor...')
    this.shouldRestart = false
    if (this.restartTimer) {
      clearTimeout(this.restartTimer)
      this.restartTimer = null
    }
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.buffer = ''
  }
}

/**
 * Polling-based fallback for active window detection.
 *
 * Uses setInterval + exec to run a simpler PowerShell command every 2 seconds.
 * This is more robust than ActiveWindowMonitor because it spawns a fresh
 * PowerShell process for each poll, avoiding issues with long-running processes.
 */
export class IntervalPoller {
  private interval: NodeJS.Timeout | null = null
  private callbacks: Array<(name: string) => void> = []

  onProcessChange(cb: (name: string) => void): void {
    this.callbacks.push(cb)
  }

  start(): void {
    console.log('[IntervalPoller] Starting polling (every 2s)...')
    this.interval = setInterval(async () => {
      try {
        const { stdout } = await execAsync(
          `powershell -NoProfile -NonInteractive -Command "& {Add-Type -Name W -MemberDefinition '[DllImport(\\"user32.dll\\")]public static extern IntPtr GetForegroundWindow();[DllImport(\\"user32.dll\\")]public static extern uint GetWindowThreadProcessId(IntPtr,out uint);' -Namespace Win32 -PassThru|Out-Null; $h=[Win32.W]::GetForegroundWindow(); $p=0; [Win32.W]::GetWindowThreadProcessId($h,[ref]$p); try{(Get-Process -Id $p).ProcessName+'.exe'}catch{''}}"`
        )
        const name = stdout?.trim() || ''
        this.callbacks.forEach(cb => cb(name))
      } catch {
        // Silently ignore poll errors
      }
    }, 2000)
    console.log('[IntervalPoller] Polling started')
  }

  stop(): void {
    console.log('[IntervalPoller] Stopping poller...')
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}

/**
 * Ultra-simple fallback that does NOT use Add-Type (no C# compilation).
 * Uses basic PowerShell cmdlets - guaranteed to work on any Windows system.
 */
export class SimplePoller {
  private interval: NodeJS.Timeout | null = null
  private callbacks: Array<(name: string) => void> = []

  onProcessChange(cb: (name: string) => void): void {
    this.callbacks.push(cb)
  }

  start(): void {
    this.interval = setInterval(async () => {
      try {
        // Pure PowerShell cmdlet — no C# compilation, no Add-Type.
        // Gets the process with the current foreground window by checking
        // which process has the active MainWindowHandle.
        // Note: this returns the most recently started windowed process,
        // which is close to but not exactly GetForegroundWindow().
        const { stdout } = await execAsync(
          `powershell -NoProfile -NonInteractive -Command "(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Sort-Object StartTime -Descending | Select-Object -First 1).ProcessName + '.exe'"`
        )
        this.callbacks.forEach(cb => cb(stdout?.trim() || ''))
      } catch {
        this.callbacks.forEach(cb => cb(''))
      }
    }, 2000)
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }
}
