import { BrowserWindow, ipcMain, screen } from 'electron'
import { readImageAsDataUrl } from './image-helper'

export interface PomodoroState {
  status: 'idle' | 'running' | 'paused'
  phase: 'work' | 'break' | 'long_break'
  remainingSeconds: number
  totalSeconds: number
  currentCycle: number
  totalCycles: number
}

const themeColors: Record<string, string> = {
  rose: '#D4A5A5',    // 莫兰迪粉
  sage: '#A8B5A0',    // 莫兰迪绿
  lavender: '#B8A9C9', // 莫兰迪紫
  sky: '#A3B1C6',     // 莫兰迪蓝
  peach: '#D4BFA5',   // 莫兰迪橙
  taupe: '#B8B0A0'    // 莫兰迪灰
}

/**
 * A small floating ball window that shows the pomodoro timer.
 * Stays on top of all windows. Draggable, frameless, transparent.
 */
export class FloatingBallWindow {
  private window: BrowserWindow | null = null
  private enabled: boolean = false
  private lastState: PomodoroState | null = null
  private ballColor: string = '#B8B0A0' // Default taupe
  private ballImageDataUrl: string | null = null

  constructor() {
    this.registerIpcHandlers()
  }

  // ---- Public API ----

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      this.hide()
    }
    // The handleTick callback will handle showing/hiding on the next tick
  }

  getEnabled(): boolean {
    return this.enabled
  }

  setThemeColor(color: string): void {
    this.ballColor = themeColors[color] || '#B8B0A0'
    if (this.window && !this.window.isDestroyed() && this.window.isVisible()) {
      this.window.webContents.send('fb:color', this.ballColor)
    }
  }

  /**
   * Sets a custom background image for the ball (null clears it and falls back
   * to the theme color). Transparent PNGs are supported.
   */
  setBallImage(imagePath: string | null | undefined): void {
    this.ballImageDataUrl = readImageAsDataUrl(imagePath)
    this.sendAppearance()
  }

  private sendAppearance(): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send('fb:color', this.ballColor)
      this.window.webContents.send('fb:image', this.ballImageDataUrl)
    } catch { /* window may be closing */ }
  }

  handleTick(state: PomodoroState): void {
    this.lastState = state
    // Show ball whenever enabled, regardless of pomodoro state
    if (this.enabled) {
      this.show()
      this.sendTick(state)
    } else {
      this.hide()
    }
  }

  show(): void {
    if (!this.enabled) return
    if (this.window && !this.window.isDestroyed()) {
      // showInactive shows the window without stealing focus
      this.window.showInactive()
      // Send appearance and state on re-show (window may have lost content)
      this.sendAppearance()
      if (this.lastState) this.sendTick(this.lastState)
      return
    }
    this.create()
    if (this.window && !this.window.isDestroyed()) {
      this.window.once('ready-to-show', () => {
        this.window?.show()
        this.sendAppearance()
        if (this.lastState) this.sendTick(this.lastState)
      })
    }
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  destroy(): void {
    if (this.window) {
      this.window.close()
      this.window = null
    }
  }

  sendTick(state: PomodoroState): void {
    if (this.window && !this.window.isDestroyed() && this.window.isVisible()) {
      try {
        this.window.webContents.send('fb:tick', { ...state, color: this.ballColor })
      } catch { /* Window may be destroyed mid-send */ }
    }
  }

  // ---- Internal ----

  create(): void {
    if (this.window && !this.window.isDestroyed()) return
    this.window = new BrowserWindow({
      // Extra height (and a little width) leaves room for the hover tooltip,
      // which used to be clipped by a 90×90 window.
      width: 100, height: 112,
      frame: false, transparent: true, alwaysOnTop: true,
      resizable: false, skipTaskbar: true, hasShadow: false,
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
    })
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.getHtml())}`)
    // Re-send appearance after (re)load so a custom background survives the
    // window being created before the page is ready.
    this.window.webContents.on('did-finish-load', () => {
      this.sendAppearance()
      if (this.lastState) this.sendTick(this.lastState)
    })
    const primaryDisplay = screen.getPrimaryDisplay()
    const { width, height } = primaryDisplay.workAreaSize
    this.window.setPosition(width - 110, height - 120)
  }

  private registerIpcHandlers(): void {
    ipcMain.on('fb:dragStart', (_event, { screenX, screenY }) => {
      if (!this.window) return
      const [wx, wy] = this.window.getPosition()
      ;(this.window as any).__dragOffset = { x: screenX - wx, y: screenY - wy }
    })
    ipcMain.on('fb:drag', (_event, { screenX, screenY }) => {
      if (!this.window) return
      const offset = (this.window as any).__dragOffset
      if (!offset) return
      this.window.setPosition(screenX - offset.x, screenY - offset.y)
    })
    ipcMain.on('fb:dragEnd', () => {
      if (!this.window) return
      delete (this.window as any).__dragOffset
    })
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>悬浮球</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;}
body{display:flex;align-items:flex-start;justify-content:center;padding-top:4px;}
#stack{display:flex;flex-direction:column;align-items:center;gap:4px;}
#ball{
  width:72px;height:72px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  cursor:grab;position:relative;flex-shrink:0;
  transition:transform 0.1s;
  background-size:cover;background-position:center;background-repeat:no-repeat;
}
#ball:active{cursor:grabbing;transform:scale(1.1);}
#time{
  font-family:monospace;font-size:16px;font-weight:700;
  color:#fff;text-shadow:0 1px 2px rgba(0,0,0,0.5);
  pointer-events:none;
}
#tooltip{
  max-width:92px;overflow:hidden;text-overflow:ellipsis;
  background:rgba(0,0,0,0.8);color:#fff;font-size:11px;line-height:1.4;
  padding:3px 8px;border-radius:6px;white-space:nowrap;
  opacity:0;transition:opacity 0.15s;pointer-events:none;
}
#ball:hover ~ #tooltip{opacity:1;}
</style></head><body>
<div id="stack">
  <div id="ball"><span id="time">25:00</span></div>
  <div id="tooltip">工作中 · 25:00</div>
</div>
<script>
var ipc=require('electron').ipcRenderer;
var timeEl=document.getElementById('time');
var tooltipEl=document.getElementById('tooltip');
var ballEl=document.getElementById('ball');
var phaseLabels={work:'工作中',break:'休息中',long_break:'长休息'};
var baseColor='#B8B0A0';
var ballImage=null;
function applyAppearance(){
  if(ballImage){
    ballEl.style.backgroundImage='url('+ballImage+')';
    ballEl.style.backgroundColor='transparent';
  }else{
    ballEl.style.backgroundImage='none';
    ballEl.style.backgroundColor=baseColor;
  }
}
// Receive theme color
ipc.on('fb:color',function(e,c){baseColor=c;applyAppearance();});
// Receive custom background image (supports transparent PNG)
ipc.on('fb:image',function(e,dataUrl){ballImage=dataUrl||null;applyAppearance();});
// Receive timer state
ipc.on('fb:tick',function(e,s){
  var m=Math.floor(s.remainingSeconds/60);
  var sec=s.remainingSeconds%60;
  var t=String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
  timeEl.textContent=t;
  tooltipEl.textContent=(phaseLabels[s.phase]||'工作中')+' · '+t;
  if(s.color){baseColor=s.color;applyAppearance();}
});
// Dragging
var drag=false;
ballEl.addEventListener('mousedown',function(e){drag=true;ipc.send('fb:dragStart',{screenX:e.screenX,screenY:e.screenY});});
document.addEventListener('mousemove',function(e){if(!drag)return;ipc.send('fb:drag',{screenX:e.screenX,screenY:e.screenY});});
document.addEventListener('mouseup',function(){if(drag){drag=false;ipc.send('fb:dragEnd');}});
<\/script></body></html>`
  }
}
