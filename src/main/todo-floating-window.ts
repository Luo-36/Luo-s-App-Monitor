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

const PANEL_WIDTH = 300
const PANEL_HEIGHT = 400
const BALL_SIZE = 64

/**
 * A small always-on-top sticky-notes style window that shows the todo list.
 * Frameless, draggable and themed with the app's accent color.
 *
 * It can collapse into a small floating ball showing the pending count; both
 * the panel and the ball support a custom background image (transparent PNGs
 * included).
 *
 * The window renders a tiny self-contained HTML page (same approach as the
 * pomodoro floating ball) and talks to the todo IPC handlers directly.
 */
export class TodoFloatingWindow {
  private window: BrowserWindow | null = null
  private enabled: boolean = false
  private accentColor: string = '#B8B0A0'
  private ballImageDataUrl: string | null = null

  constructor() {
    this.registerDragHandlers()
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
   * Sets the collapsed ball's custom background image (null clears it).
   * Transparent PNGs are supported.
   */
  setBallImage(imagePath: string | null | undefined): void {
    this.ballImageDataUrl = readImageAsDataUrl(imagePath)
    this.sendAppearance()
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
      this.refresh()
      return
    }

    this.create()
    if (this.window && !this.window.isDestroyed()) {
      this.window.once('ready-to-show', () => {
        this.window?.showInactive()
        this.sendAppearance()
      })
    }
  }

  hide(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.hide()
    }
  }

  destroy(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
  }

  // ---- Internal ----

  private sendAppearance(): void {
    if (!this.window || this.window.isDestroyed()) return
    try {
      this.window.webContents.send('todo:win:theme', this.accentColor)
      this.window.webContents.send('todo:win:image', this.ballImageDataUrl)
    } catch { /* window may be closing */ }
  }

  private create(): void {
    if (this.window && !this.window.isDestroyed()) return

    this.window = new BrowserWindow({
      width: PANEL_WIDTH,
      height: PANEL_HEIGHT,
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
    this.window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(this.getHtml())}`)

    // Re-send appearance after (re)load so a custom background survives the
    // window being created before the page is ready.
    this.window.webContents.on('did-finish-load', () => {
      this.sendAppearance()
      this.refresh()
    })

    const { workArea } = screen.getPrimaryDisplay()
    this.window.setPosition(
      workArea.x + workArea.width - PANEL_WIDTH - 24,
      workArea.y + 24
    )

    this.window.on('closed', () => {
      this.window = null
    })
  }

  private registerDragHandlers(): void {
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

    // Collapse into / expand from the floating ball
    ipcMain.on('todo:win:resize', (_event, mode: 'ball' | 'panel') => {
      if (!this.window || this.window.isDestroyed()) return
      const [x, y] = this.window.getPosition()
      if (mode === 'ball') {
        this.window.setBounds({ x, y, width: BALL_SIZE, height: BALL_SIZE })
      } else {
        this.window.setBounds({ x, y, width: PANEL_WIDTH, height: PANEL_HEIGHT })
      }
    })
  }

  private getHtml(): string {
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>待办悬浮窗</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none;}
html,body{width:100%;height:100%;overflow:hidden;background:transparent;}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;}
#app{
  width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;
  border-radius:14px;background:#0F172A;
  border:1px solid rgba(255,255,255,0.10);
  box-shadow:0 10px 30px rgba(0,0,0,0.45);
  color:#F8FAFC;
}
#header{
  height:40px;flex-shrink:0;display:flex;align-items:center;gap:8px;
  padding:0 12px;border-bottom:1px solid rgba(255,255,255,0.06);cursor:grab;
}
#header:active{cursor:grabbing;}
#title{font-size:13px;font-weight:600;letter-spacing:0.4px;}
#count{font-size:11px;color:#94A3B8;}
.hbtn{
  width:22px;height:22px;border:none;border-radius:6px;
  background:transparent;color:#94A3B8;font-size:13px;line-height:1;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
}
.hbtn:hover{background:rgba(255,255,255,0.08);color:#fff;}
#collapse{margin-left:auto;}
#list{flex:1;overflow-y:auto;padding:8px;}
#empty{text-align:center;color:#64748B;font-size:12px;padding:32px 12px;line-height:1.7;}
.todo{
  display:flex;align-items:flex-start;gap:8px;padding:7px 8px;border-radius:8px;
  font-size:12.5px;line-height:1.4;
}
.todo:hover{background:rgba(255,255,255,0.05);}
.check{
  width:15px;height:15px;flex-shrink:0;margin-top:1px;border-radius:4px;
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
  flex-shrink:0;display:flex;gap:6px;padding:8px;
  border-top:1px solid rgba(255,255,255,0.06);
}
#newTodo{
  flex:1;min-width:0;padding:7px 10px;border-radius:8px;font-size:12px;
  background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.08);
  color:#fff;outline:none;
}
#newTodo::placeholder{color:#64748B;}
#newTodo:focus{border-color:var(--accent);}
#addBtn{
  flex-shrink:0;padding:0 12px;border:none;border-radius:8px;font-size:12px;
  font-weight:600;color:#0F172A;background:var(--accent);cursor:pointer;
}
#addBtn:hover{filter:brightness(1.08);}
#ballWrap{
  display:none;width:100%;height:100%;align-items:center;justify-content:center;
}
#ball{
  width:56px;height:56px;border-radius:50%;position:relative;cursor:grab;
  background:var(--accent);
  background-size:cover;background-position:center;background-repeat:no-repeat;
  display:flex;align-items:center;justify-content:center;
}
#ball:active{cursor:grabbing;}
#badge{
  position:absolute;top:-3px;right:-3px;min-width:18px;height:18px;padding:0 4px;
  border-radius:9px;background:#EF4444;color:#fff;font-size:10px;font-weight:700;
  display:none;align-items:center;justify-content:center;
  border:1.5px solid rgba(15,23,42,0.9);
}
#ballIcon{color:#0F172A;pointer-events:none;opacity:0.85;}
::-webkit-scrollbar{width:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.3);border-radius:2px;}
</style></head><body>
<div id="app">
  <div id="header">
    <span id="title">待办</span>
    <span id="count"></span>
    <button id="collapse" class="hbtn" title="缩小为悬浮球">−</button>
    <button id="close" class="hbtn" title="关闭悬浮窗">✕</button>
  </div>
  <div id="list"></div>
  <div id="addRow">
    <input id="newTodo" maxlength="200" placeholder="添加待办，回车确认" />
    <button id="addBtn">添加</button>
  </div>
</div>
<div id="ballWrap">
  <div id="ball">
    <svg id="ballIcon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
    <span id="badge"></span>
  </div>
</div>
<script>
var ipc = require('electron').ipcRenderer;
var appEl = document.getElementById('app');
var panelHeader = document.getElementById('header');
var listEl = document.getElementById('list');
var countEl = document.getElementById('count');
var inputEl = document.getElementById('newTodo');
var ballWrap = document.getElementById('ballWrap');
var ballEl = document.getElementById('ball');
var badgeEl = document.getElementById('badge');
var currentTodos = [];
var pendingCount = 0;
var ballImage = null;
var ballIcon = document.getElementById('ballIcon');
var mode = 'panel';
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

function enterBallMode() {
  mode = 'ball';
  appEl.style.display = 'none';
  ballWrap.style.display = 'flex';
  ipc.send('todo:win:resize', 'ball');
}

function enterPanelMode() {
  mode = 'panel';
  ballWrap.style.display = 'none';
  appEl.style.display = 'flex';
  ipc.send('todo:win:resize', 'panel');
}

document.getElementById('collapse').addEventListener('click', enterBallMode);
document.getElementById('close').addEventListener('click', function () {
  ipc.send('todo:floating-close');
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

// Drag the window by its header (panel) or the ball itself
var drag = { active: false, moved: false, sx: 0, sy: 0 };

function startDrag(e) {
  drag.active = true;
  drag.moved = false;
  drag.sx = e.screenX;
  drag.sy = e.screenY;
  ipc.send('todo:win:dragStart', { screenX: e.screenX, screenY: e.screenY });
}

panelHeader.addEventListener('mousedown', function (e) {
  if (e.target.closest('button')) return;
  startDrag(e);
});

ballEl.addEventListener('mousedown', function (e) {
  if (e.button !== 0) return;
  e.preventDefault();
  startDrag(e);
});

ballEl.addEventListener('mouseup', function () {
  // A click without movement expands the panel; dragging just moves the ball.
  if (drag.active && !drag.moved) enterPanelMode();
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
