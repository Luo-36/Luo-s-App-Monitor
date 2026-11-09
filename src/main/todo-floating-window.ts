import { BrowserWindow, ipcMain, screen } from 'electron'
import { readImageAsDataUrl } from './image-helper'

const themeColors: Record<string, string> = {
  rose: '#D4A5A5',     // 莫兰迪粉
  sage: '#A8B5A0',     // 莫兰迪绿
  lavender: '#B8A9C9', // 莫兰迪紫
  sky: '#A3B1C6',      // 莫兰迪蓝
  peach: '#D4BFA5',    // 莫兰迪橙
  taupe: '#B8B0A0'     // 莫兰迪灰
}

const DEFAULT_BALL_SIZE = 56
/** Extra space around the ball so the pending badge is never clipped. */
const BALL_MARGIN = 4
/** Gap between the ball and its chat bubble. */
const BUBBLE_GAP = 10
const BUBBLE_WIDTH = 300
const BUBBLE_HEIGHT = 380
const NOTIFICATION_HEIGHT = 128
const MIN_TODO_HEIGHT = 160
const MIN_NOTIFICATION_HEIGHT = 96
/** How long a chat-bubble notification stays visible. */
const NOTIFICATION_DURATION_MS = 8000
/** Small transparent margin around the combined ball + bubble bounds. */
const BUBBLE_PAD = 8

interface WindowLayout {
  expanded: boolean
  mode: 'todo' | 'notification'
  ballLeft: number
  ballTop: number
  bubbleLeft: number
  bubbleTop: number
  bubbleWidth: number
  bubbleHeight: number
}

interface BubblePlacement {
  x: number
  y: number
  width: number
  height: number
}

interface ChatNotification {
  title: string
  body: string
}

/**
 * A small always-on-top sticky-notes window.
 *
 * It shows a floating ball with the pending count. Clicking the ball opens
 * the todo list as a chat bubble (default: above-left of the ball) while the
 * ball stays visible. When enabled, system notifications are also mirrored
 * into the same chat bubble.
 */
export class TodoFloatingWindow {
  private window: BrowserWindow | null = null
  private enabled: boolean = false
  private accentColor: string = '#B8B0A0'
  private ballImageDataUrl: string | null = null
  private ballSize: number = DEFAULT_BALL_SIZE
  private ballShape: 'circle' | 'square' = 'circle'
  private expanded: boolean = true
  private chatNotificationsEnabled: boolean = true
  private notification: ChatNotification | null = null
  private notificationTimer: NodeJS.Timeout | null = null

  /** Top-left of the ball inside the window. */
  private ballOffset = { x: BALL_MARGIN, y: BALL_MARGIN }
  private layout: WindowLayout = {
    expanded: false,
    mode: 'todo',
    ballLeft: BALL_MARGIN,
    ballTop: BALL_MARGIN,
    bubbleLeft: 0,
    bubbleTop: 0,
    bubbleWidth: BUBBLE_WIDTH,
    bubbleHeight: BUBBLE_HEIGHT
  }

  constructor() {
    this.registerIpcHandlers()
  }

  // ---- Public API ----

  setEnabled(enabled: boolean, themeColor?: string): void {
    this.enabled = enabled
    if (themeColor) this.accentColor = themeColors[themeColor] || '#B8B0A0'

    if (enabled) {
      this.show()
    } else {
      this.hide()
    }
  }

  getEnabled(): boolean {
    return this.enabled
  }

  setThemeColor(color: string): void {
    this.accentColor = themeColors[color] || '#B8B0A0'
    this.sendAppearance()
  }

  /**
   * Sets the floating ball's custom background image (null clears it).
   * Transparent PNGs are supported.
   */
  setBallImage(imagePath: string | null | undefined): void {
    this.ballImageDataUrl = readImageAsDataUrl(imagePath)
    this.sendAppearance()
  }

  /** Updates the floating ball's size (px) and circle/square shape. */
  setBallMetrics(size: number | undefined, shape: string | undefined): void {
    const nextSize = Number(size)
    if (Number.isFinite(nextSize)) {
      this.ballSize = Math.min(140, Math.max(40, Math.round(nextSize)))
    }
    this.ballShape = shape === 'square' ? 'square' : 'circle'

    this.applyLayout()
    this.sendAppearance()
  }

  /** Enables/disables mirroring system notifications into the chat bubble. */
  setChatNotificationsEnabled(enabled: boolean): void {
    this.chatNotificationsEnabled = !!enabled
    if (!this.chatNotificationsEnabled) {
      this.clearNotification()
    }
  }

  /**
   * Shows a notification as a chat bubble attached to the floating ball.
   * Returns true when the bubble actually displayed it (the caller then
   * skips the native system notification). No-op when the floating window
   * or the chat-notification option is off.
   */
  notify(title: string, body: string): boolean {
    if (!this.enabled || !this.chatNotificationsEnabled) return false
    if (!this.window || this.window.isDestroyed()) return false

    this.notification = { title: title || '通知', body: body || '' }
    this.sendNotificationContent()
    this.applyLayout()

    if (!this.window.isVisible()) {
      this.window.showInactive()
    }

    if (this.notificationTimer) clearTimeout(this.notificationTimer)
    this.notificationTimer = setTimeout(() => this.clearNotification(), NOTIFICATION_DURATION_MS)

    return true
  }

  /** Ask the floating window to re-fetch the todo list. */
  refresh(): void {
    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.webContents.send('todos:changed')
      } catch { /* window may be closing */ }
    }
  }

  show(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.showInactive()
      this.sendAppearance()
      this.sendLayout()
      this.sendNotificationContent()
      this.refresh()
      return
    }

    this.create()
    if (this.window && !this.window.isDestroyed()) {
      this.window.once('ready-to-show', () => {
        this.window?.showInactive()
        this.sendAppearance()
        this.sendLayout()
        this.sendNotificationContent()
      })
    }
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  destroy(): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer)
      this.notificationTimer = null
    }
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
  }

  // ---- Internal ----

  private clearNotification(): void {
    if (this.notificationTimer) {
      clearTimeout(this.notificationTimer)
      this.notificationTimer = null
    }
    if (!this.notification) return

    this.notification = null
    this.sendNotificationContent()
    this.applyLayout()
  }

  private sendAppearance(): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send('todo:win:theme', this.accentColor)
      this.window.webContents.send('todo:win:image', this.ballImageDataUrl)
      this.window.webContents.send('todo:win:metrics', {
        size: this.ballSize,
        shape: this.ballShape
      })
    } catch { /* window may be closing */ }
  }

  private sendLayout(): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send('todo:win:layout', this.layout)
    } catch { /* window may be closing */ }
  }

  private sendNotificationContent(): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send('todo:win:notification', this.notification)
    } catch { /* window may be closing */ }
  }

  /** Top-left of the ball in screen coordinates. */
  private getBallScreenPos(): { x: number; y: number } {
    if (!this.window || this.window.isDestroyed()) return { x: 0, y: 0 }
    const [wx, wy] = this.window.getPosition()
    return { x: wx + this.ballOffset.x, y: wy + this.ballOffset.y }
  }

  /**
   * Places the bubble relative to the ball. Preferred position is the
   * upper-left of the ball; other sides are used when there is no room.
   */
  private computeBubblePlacement(
    ball: { x: number; y: number },
    bubbleWidth: number,
    preferredHeight: number,
    minHeight: number
  ): BubblePlacement {
    const ballRect = {
      x: ball.x,
      y: ball.y,
      width: this.ballSize,
      height: this.ballSize
    }
    const { workArea } = screen.getDisplayMatching(ballRect)

    const margin = 8
    const areaLeft = workArea.x + margin
    const areaTop = workArea.y + margin
    const areaRight = workArea.x + workArea.width - margin
    const areaBottom = workArea.y + workArea.height - margin

    const spaceAbove = ball.y - BUBBLE_GAP - areaTop
    const spaceBelow = areaBottom - (ball.y + this.ballSize + BUBBLE_GAP)
    const spaceLeft = ball.x - BUBBLE_GAP - areaLeft
    const spaceRight = areaRight - (ball.x + this.ballSize + BUBBLE_GAP)

    // Vertical: prefer above (the requested default), then below; shrink if
    // neither side can fit the full bubble.
    let above = true
    let height = preferredHeight
    if (spaceAbove >= preferredHeight) {
      above = true
    } else if (spaceBelow >= preferredHeight) {
      above = false
    } else {
      above = spaceAbove >= spaceBelow
      height = Math.max(minHeight, Math.min(preferredHeight, above ? spaceAbove : spaceBelow))
    }

    // Horizontal: prefer left, then right, then clamp inside the work area.
    let x: number
    if (spaceLeft >= bubbleWidth) {
      x = ball.x - BUBBLE_GAP - bubbleWidth
    } else if (spaceRight >= bubbleWidth) {
      x = ball.x + this.ballSize + BUBBLE_GAP
    } else {
      x = Math.max(
        areaLeft,
        Math.min(ball.x - BUBBLE_GAP - bubbleWidth, areaRight - bubbleWidth)
      )
    }

    let y = above
      ? ball.y - BUBBLE_GAP - height
      : ball.y + this.ballSize + BUBBLE_GAP

    // Final vertical clamp so the bubble stays inside the work area.
    if (above && y < areaTop) {
      height = Math.max(minHeight, ball.y - BUBBLE_GAP - areaTop)
      y = ball.y - BUBBLE_GAP - height
    } else if (!above && y + height > areaBottom) {
      height = Math.max(minHeight, areaBottom - y)
    }

    x = Math.max(areaLeft, Math.min(x, areaRight - bubbleWidth))

    return {
      x,
      y,
      width: bubbleWidth,
      height
    }
  }

  /**
   * Recomputes the window bounds from the ball's current screen position.
   * The ball is the anchor: it must not move when the bubble opens/closes.
   */
  private applyLayout(): void {
    if (!this.window || this.window.isDestroyed()) return

    const ball = this.getBallScreenPos()
    const showBubble = this.expanded || this.notification !== null

    if (!showBubble) {
      const size = this.ballSize + BALL_MARGIN * 2
      this.window.setBounds({
        x: ball.x - BALL_MARGIN,
        y: ball.y - BALL_MARGIN,
        width: size,
        height: size
      })
      this.ballOffset = { x: BALL_MARGIN, y: BALL_MARGIN }
      this.layout = {
        expanded: false,
        mode: 'todo',
        ballLeft: BALL_MARGIN,
        ballTop: BALL_MARGIN,
        bubbleLeft: 0,
        bubbleTop: 0,
        bubbleWidth: BUBBLE_WIDTH,
        bubbleHeight: 0
      }
      this.sendLayout()
      return
    }

    const mode: WindowLayout['mode'] = this.notification ? 'notification' : 'todo'
    const preferredHeight = mode === 'notification' ? NOTIFICATION_HEIGHT : BUBBLE_HEIGHT
    const minHeight = mode === 'notification' ? MIN_NOTIFICATION_HEIGHT : MIN_TODO_HEIGHT

    const bubble = this.computeBubblePlacement(ball, BUBBLE_WIDTH, preferredHeight, minHeight)

    // A small transparent margin keeps the bubble edge from being clipped
    // by the window bounds.
    const left = Math.min(ball.x - BALL_MARGIN, bubble.x) - BUBBLE_PAD
    const top = Math.min(ball.y - BALL_MARGIN, bubble.y) - BUBBLE_PAD
    const right = Math.max(ball.x + this.ballSize + BALL_MARGIN, bubble.x + bubble.width) + BUBBLE_PAD
    const bottom = Math.max(ball.y + this.ballSize + BALL_MARGIN, bubble.y + bubble.height) + BUBBLE_PAD

    const ballLeft = ball.x - left
    const ballTop = ball.y - top

    this.window.setBounds({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top
    })

    this.ballOffset = { x: ballLeft, y: ballTop }
    this.layout = {
      expanded: true,
      mode,
      ballLeft,
      ballTop,
      bubbleLeft: bubble.x - left,
      bubbleTop: bubble.y - top,
      bubbleWidth: bubble.width,
      bubbleHeight: bubble.height
    }
    this.sendLayout()
  }

  private setExpanded(expanded: boolean): void {
    this.expanded = expanded
    this.applyLayout()
  }

  private create(): void {
    if (this.window && !this.window.isDestroyed()) return

    const { workArea } = screen.getPrimaryDisplay()
    const size = this.ballSize + BALL_MARGIN * 2
    // Default near the bottom-right so the bubble has room above-left. Keep
    // it above the pomodoro floating ball's corner to avoid overlapping it.
    const ballX = workArea.x + workArea.width - 24 - this.ballSize
    const ballY = workArea.y + workArea.height - 150 - this.ballSize

    this.window = new BrowserWindow({
      width: size,
      height: size,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false }
    })

    this.window.setAlwaysOnTop(true, 'floating')
    this.window.setPosition(ballX - BALL_MARGIN, ballY - BALL_MARGIN)
    this.ballOffset = { x: BALL_MARGIN, y: BALL_MARGIN }
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.getHtml())}`)

    this.window.webContents.on('did-finish-load', () => {
      this.sendAppearance()
      this.sendLayout()
      this.sendNotificationContent()
      this.refresh()
    })

    this.window.on('closed', () => {
      this.window = null
    })

    this.applyLayout()
  }

  private registerIpcHandlers(): void {
    ipcMain.on('todo:win:dragStart', (_event, { screenX, screenY }) => {
      if (!this.window || this.window.isDestroyed()) return
      const [wx, wy] = this.window.getPosition()
      ;(this.window as any).__dragOffset = { x: screenX - wx, y: screenY - wy }
    })

    ipcMain.on('todo:win:drag', (_event, { screenX, screenY }) => {
      if (!this.window || this.window.isDestroyed()) return
      const offset = (this.window as any).__dragOffset
      if (!offset) return
      this.window.setPosition(screenX - offset.x, screenY - offset.y)
    })

    ipcMain.on('todo:win:dragEnd', () => {
      if (this.window && !this.window.isDestroyed()) {
        delete (this.window as any).__dragOffset
      }
    })

    // Ball click: dismiss a notification first, otherwise toggle the list.
    ipcMain.on('todo:win:toggle', () => {
      if (this.notification) {
        this.clearNotification()
        return
      }
      this.setExpanded(!this.expanded)
    })

    ipcMain.on('todo:win:collapse', () => {
      this.setExpanded(false)
    })

    ipcMain.on('todo:win:dismiss-notification', () => {
      this.clearNotification()
    })
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>待办悬浮窗</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;}
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',Arial,sans-serif;}
#ballWrap{
  position:absolute;left:4px;top:4px;
  width:var(--ball-size,56px);height:var(--ball-size,56px);
  cursor:grab;transition:transform 0.16s ease;
}
#ballWrap:hover{transform:scale(1.04);}
#ballWrap:active{cursor:grabbing;transform:scale(0.98);}
#ball{
  width:100%;height:100%;border-radius:var(--ball-radius,50%);position:relative;
  background:var(--accent);
  background-size:cover;background-position:center;background-repeat:no-repeat;
  display:flex;align-items:center;justify-content:center;
}
#badge{
  position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;padding:0 4px;
  border-radius:9px;background:#EF4444;color:#fff;font-size:10px;font-weight:700;
  display:none;align-items:center;justify-content:center;
  border:1.5px solid rgba(15,23,42,0.9);
}
#ballIcon{color:#0F172A;pointer-events:none;opacity:0.85;}
#bubble{
  position:absolute;display:none;flex-direction:column;
  border-radius:18px;background:#0F172A;
  border:1px solid rgba(255,255,255,0.12);
  color:#F8FAFC;
  transform-origin:100% 100%;
  animation:bubbleIn 160ms cubic-bezier(0.2,0.8,0.2,1);
}
@keyframes bubbleIn{
  from{opacity:0;transform:scale(0.96);}
  to{opacity:1;transform:scale(1);}
}
#todoView{display:none;flex-direction:column;flex:1;min-height:0;overflow:hidden;border-radius:18px;}
#header{
  height:44px;flex-shrink:0;display:flex;align-items:center;gap:8px;
  padding:0 14px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:grab;
}
#header:active{cursor:grabbing;}
#title{font-size:13.5px;font-weight:600;letter-spacing:0.3px;}
#count{
  display:none;font-size:11px;color:#94A3B8;
  background:rgba(255,255,255,0.06);padding:2px 8px;border-radius:999px;
  white-space:nowrap;
}
.hbtn{
  width:22px;height:22px;border:none;border-radius:6px;
  background:transparent;color:#94A3B8;font-size:13px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
}
.hbtn:hover{background:rgba(255,255,255,0.08);color:#fff;}
#collapse{margin-left:auto;}
#list{flex:1;overflow-y:auto;padding:8px 10px;}
#empty{text-align:center;color:#64748B;font-size:12px;padding:34px 12px;line-height:1.7;}
.todo{
  display:flex;align-items:flex-start;gap:9px;padding:8px 9px;border-radius:10px;
  font-size:12.5px;line-height:1.45;
}
.todo:hover{background:rgba(255,255,255,0.055);}
.check{
  width:16px;height:16px;flex-shrink:0;margin-top:1px;border-radius:5px;
  border:1.5px solid #64748B;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:background 0.12s,border-color 0.12s;
}
.check svg{opacity:0;}
.todo.done .check{background:var(--accent);border-color:var(--accent);}
.todo.done .check svg{opacity:1;}
.todo.done .txt{color:#64748B;text-decoration:line-through;}
.txt{flex:1;word-break:break-word;}
.del{
  flex-shrink:0;padding:0 2px;color:#64748B;font-size:13px;cursor:pointer;
  opacity:0;transition:opacity 0.12s;
}
.todo:hover .del{opacity:1;}
.del:hover{color:#F87171;}
#addRow{
  flex-shrink:0;display:flex;gap:8px;padding:10px;
  border-top:1px solid rgba(255,255,255,0.06);
}
#newTodo{
  flex:1;min-width:0;padding:8px 11px;border-radius:10px;font-size:12px;
  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);
  color:#fff;outline:none;
  transition:border-color 0.15s, box-shadow 0.15s, background 0.15s;
}
#newTodo::placeholder{color:#64748B;}
#newTodo:focus{
  border-color:var(--accent);background:rgba(255,255,255,0.08);
  box-shadow:0 0 0 3px rgba(255,255,255,0.06);
}
#addBtn{
  flex-shrink:0;padding:0 14px;border:none;border-radius:10px;font-size:12px;
  font-weight:600;color:#0F172A;background:var(--accent);cursor:pointer;
  transition:filter 0.15s, transform 0.15s;
}
#addBtn:hover{filter:brightness(1.08);}
#addBtn:active{transform:scale(0.97);}
#notificationView{
  display:none;flex-direction:column;flex:1;min-height:0;
  padding:14px 16px;gap:8px;border-radius:18px;
}
#notifHeader{display:flex;align-items:center;gap:10px;flex-shrink:0;}
#notifIconWrap{
  width:30px;height:30px;border-radius:10px;flex-shrink:0;
  display:flex;align-items:center;justify-content:center;
  background:color-mix(in srgb, var(--accent) 18%, transparent);
}
#notifIcon{color:var(--accent);flex-shrink:0;}
#notifTitle{
  flex:1;min-width:0;font-size:13px;font-weight:600;color:#fff;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
#notifBody{
  flex:1;overflow-y:auto;font-size:12px;line-height:1.55;color:#CBD5E1;
  white-space:pre-wrap;word-break:break-word;
}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.3);border-radius:2px;}
</style></head><body>
<div id="ballWrap">
  <div id="ball">
    <svg id="ballIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
    <span id="badge"></span>
  </div>
</div>
<div id="bubble">
  <div id="todoView">
    <div id="header">
      <span id="title">待办</span>
      <span id="count"></span>
      <button id="collapse" class="hbtn" title="收起气泡">−</button>
      <button id="close" class="hbtn" title="关闭悬浮窗">✕</button>
    </div>
    <div id="list"></div>
    <div id="addRow">
      <input id="newTodo" maxlength="200" placeholder="添加待办，回车确认" />
      <button id="addBtn">添加</button>
    </div>
  </div>
  <div id="notificationView">
    <div id="notifHeader">
      <div id="notifIconWrap">
        <svg id="notifIcon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
      </div>
      <span id="notifTitle">通知</span>
      <button id="notifClose" class="hbtn" title="关闭通知">✕</button>
    </div>
    <div id="notifBody"></div>
  </div>
</div>
<script>
var ipc = require('electron').ipcRenderer;
var ballWrap = document.getElementById('ballWrap');
var ballEl = document.getElementById('ball');
var ballIcon = document.getElementById('ballIcon');
var bubbleEl = document.getElementById('bubble');
var todoView = document.getElementById('todoView');
var notificationView = document.getElementById('notificationView');
var notifTitle = document.getElementById('notifTitle');
var notifBody = document.getElementById('notifBody');
var headerEl = document.getElementById('header');
var listEl = document.getElementById('list');
var countEl = document.getElementById('count');
var inputEl = document.getElementById('newTodo');
var badgeEl = document.getElementById('badge');
var currentTodos = [];
var pendingCount = 0;
var ballImage = null;
var CHECK_SVG = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0F172A" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function applyBallAppearance() {
  if (ballImage) {
    ballEl.style.backgroundImage = 'url(' + ballImage + ')';
    ballEl.style.backgroundColor = 'transparent';
    ballIcon.style.display = 'none';
  } else {
    ballEl.style.backgroundImage = 'none';
    ballEl.style.backgroundColor = 'var(--accent)';
    ballIcon.style.display = 'block';
  }
}

function updateBadge() {
  badgeEl.textContent = pendingCount > 9 ? '9+' : String(pendingCount);
  badgeEl.style.display = pendingCount > 0 ? 'flex' : 'none';
}

function render(todos) {
  currentTodos = todos || [];
  pendingCount = currentTodos.filter(function (t) { return !t.is_done; }).length;
  countEl.textContent = pendingCount > 0 ? pendingCount + ' 项' : '';
  countEl.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  updateBadge();

  if (currentTodos.length === 0) {
    listEl.innerHTML = '<div id="empty">暂无待办<br/>在下方输入框添加一条</div>';
    return;
  }
  listEl.innerHTML = currentTodos.map(function (t) {
    return '<div class="todo' + (t.is_done ? ' done' : '') + '" data-id="' + t.id + '">' +
      '<div class="check" data-action="toggle">' + CHECK_SVG + '</div>' +
      '<div class="txt">' + esc(t.title) + '</div>' +
      '<div class="del" data-action="del" title="删除">✕</div>' +
      '</div>';
  }).join('');
}

async function refresh() {
  try {
    var todos = await ipc.invoke('todo:getAll');
    render(todos);
  } catch (e) { /* main process not ready yet */ }
}

listEl.addEventListener('click', async function (e) {
  var actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;
  var row = actionEl.closest('.todo');
  if (!row) return;
  var id = Number(row.dataset.id);
  if (actionEl.dataset.action === 'del') {
    await ipc.invoke('todo:delete', id);
  } else {
    await ipc.invoke('todo:toggle', id);
  }
  refresh();
});

async function addTodo() {
  var title = inputEl.value.trim();
  if (!title) return;
  inputEl.value = '';
  await ipc.invoke('todo:add', title);
  refresh();
}

document.getElementById('addBtn').addEventListener('click', addTodo);
inputEl.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') addTodo();
});

document.getElementById('collapse').addEventListener('click', function () {
  ipc.send('todo:win:collapse');
});
document.getElementById('close').addEventListener('click', function () {
  ipc.send('todo:floating-close');
});
document.getElementById('notifClose').addEventListener('click', function () {
  ipc.send('todo:win:dismiss-notification');
});

// Keep the list in sync with the main window
ipc.on('todos:changed', refresh);

// Theme accent color from the app profile
ipc.on('todo:win:theme', function (e, color) {
  document.documentElement.style.setProperty('--accent', color);
});

// Custom ball background (supports transparent PNG)
ipc.on('todo:win:image', function (e, dataUrl) {
  ballImage = dataUrl || null;
  applyBallAppearance();
});

// Size / shape of the ball
ipc.on('todo:win:metrics', function (e, m) {
  if (!m) return;
  var size = Math.max(40, Math.min(140, Number(m.size) || 56));
  var radius = m.shape === 'square' ? Math.max(8, Math.round(size * 0.18)) + 'px' : '50%';
  document.documentElement.style.setProperty('--ball-size', size + 'px');
  document.documentElement.style.setProperty('--ball-radius', radius);
  var iconSize = Math.round(size * 0.36);
  ballIcon.setAttribute('width', iconSize);
  ballIcon.setAttribute('height', iconSize);
});

// Notification text
ipc.on('todo:win:notification', function (e, n) {
  notifTitle.textContent = n && n.title ? n.title : '通知';
  notifBody.textContent = n && n.body ? n.body : '';
});

// Ball + bubble placement inside the (transparent) window
ipc.on('todo:win:layout', function (e, l) {
  if (!l) return;
  ballWrap.style.left = l.ballLeft + 'px';
  ballWrap.style.top = l.ballTop + 'px';
  bubbleEl.style.display = l.expanded ? 'flex' : 'none';
  if (!l.expanded) return;

  bubbleEl.style.left = l.bubbleLeft + 'px';
  bubbleEl.style.top = l.bubbleTop + 'px';
  bubbleEl.style.width = l.bubbleWidth + 'px';
  bubbleEl.style.height = l.bubbleHeight + 'px';

  var showNotification = l.mode === 'notification';
  notificationView.style.display = showNotification ? 'flex' : 'none';
  todoView.style.display = showNotification ? 'none' : 'flex';
});

// Drag the window by the ball or the bubble header
var drag = { active: false, moved: false, sx: 0, sy: 0 };

function startDrag(e) {
  drag.active = true;
  drag.moved = false;
  drag.sx = e.screenX;
  drag.sy = e.screenY;
  ipc.send('todo:win:dragStart', { screenX: e.screenX, screenY: e.screenY });
}

ballWrap.addEventListener('mousedown', function (e) {
  if (e.button !== 0) return;
  e.preventDefault();
  startDrag(e);
});

ballWrap.addEventListener('mouseup', function () {
  // A click without movement toggles the bubble; dragging just moves it.
  if (drag.active && !drag.moved) ipc.send('todo:win:toggle');
});

headerEl.addEventListener('mousedown', function (e) {
  if (e.target.closest('button')) return;
  startDrag(e);
});

document.addEventListener('mousemove', function (e) {
  if (!drag.active) return;
  if (Math.abs(e.screenX - drag.sx) > 3 || Math.abs(e.screenY - drag.sy) > 3) {
    drag.moved = true;
  }
  ipc.send('todo:win:drag', { screenX: e.screenX, screenY: e.screenY });
});

document.addEventListener('mouseup', function () {
  if (!drag.active) return;
  drag.active = false;
  ipc.send('todo:win:dragEnd');
});

// Ask for data as soon as the page is alive
document.documentElement.style.setProperty('--accent', '#B8B0A0');
setTimeout(refresh, 0);
<\/script></body></html>`
  }
}
