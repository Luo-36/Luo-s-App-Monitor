import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Bell, Check, Clock, ImagePlus, ListTodo, MonitorUp, Plus, Trash2 } from 'lucide-react'
import type { Reminder, Todo } from '@/types'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Switch from '@/components/ui/Switch'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const QUICK_MINUTES = [5, 15, 30, 60]

function formatRemaining(ms: number): string {
  if (ms <= 0) return '即将提醒'
  const totalSec = Math.ceil(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatClock(epochMs: number): string {
  const d = new Date(epochMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export const TodoPage: React.FC = () => {
  const [todos, setTodos] = useState<Todo[]>([])
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [newTodo, setNewTodo] = useState('')
  const [reminderTitle, setReminderTitle] = useState('')
  const [reminderMinutes, setReminderMinutes] = useState('15')
  const [reminderError, setReminderError] = useState('')
  const [floatingEnabled, setFloatingEnabled] = useState(false)
  const [ballImage, setBallImage] = useState<string | null>(null)
  const [uploadingBallImage, setUploadingBallImage] = useState(false)
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(() => Date.now())

  const loadTodos = useCallback(async () => {
    try {
      setTodos(await api.getTodos())
    } catch (err) {
      console.error('Failed to load todos:', err)
    }
  }, [])

  const loadReminders = useCallback(async () => {
    try {
      setReminders(await api.getReminders())
    } catch (err) {
      console.error('Failed to load reminders:', err)
    }
  }, [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [todoList, reminderList, floating, profile] = await Promise.all([
          api.getTodos(),
          api.getReminders(),
          api.getTodoFloatingEnabled(),
          api.getProfile()
        ])
        setTodos(todoList)
        setReminders(reminderList)
        setFloatingEnabled(floating)
        setBallImage(profile.todo_floating_ball_image ?? null)
      } catch (err) {
        console.error('Failed to load todo page data:', err)
      } finally {
        setLoading(false)
      }
    }
    load()

    const unsubTodos = api.onTodosChanged(() => {
      loadTodos()
    })
    const unsubReminders = api.onRemindersChanged(() => {
      loadReminders()
    })
    const unsubFloating = api.onTodoFloatingState((enabled) => {
      setFloatingEnabled(enabled)
    })

    return () => {
      unsubTodos()
      unsubReminders()
      unsubFloating()
    }
  }, [loadTodos, loadReminders])

  // Tick once a second so reminder countdowns stay live.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const pendingTodos = useMemo(() => todos.filter((t) => !t.is_done), [todos])
  const completedTodos = useMemo(() => todos.filter((t) => t.is_done), [todos])

  const handleAddTodo = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const title = newTodo.trim()
    if (!title) return
    setNewTodo('')
    await api.addTodo(title)
    loadTodos()
  }

  const handleToggleTodo = async (todo: Todo) => {
    await api.toggleTodo(todo.id)
    loadTodos()
  }

  const handleDeleteTodo = async (id: number) => {
    await api.deleteTodo(id)
    loadTodos()
  }

  const handleClearCompleted = async () => {
    await api.clearCompletedTodos()
    loadTodos()
  }

  const handleToggleFloating = async (enabled: boolean) => {
    setFloatingEnabled(enabled)
    try {
      const actual = await api.setTodoFloatingEnabled(enabled)
      setFloatingEnabled(actual)
    } catch (err) {
      console.error('Failed to toggle todo floating window:', err)
      setFloatingEnabled(!enabled)
    }
  }

  const handleUploadBallImage = async () => {
    setUploadingBallImage(true)
    try {
      const filePath = await api.openFileDialog([
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
      ])
      if (!filePath) return

      const dataUrl = await api.readFileAsBase64(filePath)
      if (!dataUrl) return

      const extMatch = /\.([a-zA-Z0-9]+)$/.exec(filePath)
      const ext = extMatch ? extMatch[1].toLowerCase() : 'png'
      const savedPath = await api.saveImage(
        dataUrl,
        'floating',
        `todo_ball_${Date.now()}.${ext}`
      )
      await api.updateProfile({ todo_floating_ball_image: savedPath })
      setBallImage(savedPath)
    } catch (err) {
      console.error('Failed to upload todo ball image:', err)
    } finally {
      setUploadingBallImage(false)
    }
  }

  const handleClearBallImage = async () => {
    try {
      await api.updateProfile({ todo_floating_ball_image: null })
      setBallImage(null)
    } catch (err) {
      console.error('Failed to clear todo ball image:', err)
    }
  }

  const handleAddReminder = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const title = reminderTitle.trim()
    const minutes = Number(reminderMinutes)
    if (!title) {
      setReminderError('请输入提醒内容')
      return
    }
    if (!Number.isFinite(minutes) || minutes <= 0) {
      setReminderError('请输入有效的分钟数')
      return
    }
    setReminderError('')
    setReminderTitle('')
    await api.addReminder(title, minutes)
    loadReminders()
  }

  const handleDeleteReminder = async (id: number) => {
    await api.deleteReminder(id)
    loadReminders()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">待办</h1>
        {/* <span className="text-sm text-text-secondary">
          {pendingTodos.length > 0 ? `还有 ${pendingTodos.length} 项未完成` : '全部完成 🎉'}
        </span> */ } 
      </div>

      {/* Desktop floating window toggle */}
      <Card className="p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <MonitorUp className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-sm font-medium text-white">桌面悬浮窗</div>
              <div className="text-xs text-text-secondary">
                在桌面置顶显示待办清单，可缩小为悬浮球
              </div>
            </div>
          </div>
          <Switch checked={floatingEnabled} onChange={handleToggleFloating} />
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-white">悬浮球背景</div>
            <div className="text-xs text-text-secondary">
              待办悬浮窗缩小为悬浮球时使用，支持透明 PNG
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {ballImage && (
              <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 border border-white/10 shrink-0">
                <img
                  src={toFileUrl(ballImage) || ''}
                  alt="悬浮球背景"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            {ballImage && (
              <Button variant="ghost" size="sm" onClick={handleClearBallImage}>
                <Trash2 className="w-4 h-4" />
                清除
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUploadBallImage}
              loading={uploadingBallImage}
            >
              <ImagePlus className="w-4 h-4" />
              上传
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* ===== Todo list ===== */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <ListTodo className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-white">待办事项</h2>
            <span className="ml-auto text-xs text-text-secondary">
              {pendingTodos.length} / {todos.length}
            </span>
          </div>

          <form onSubmit={handleAddTodo} className="flex items-start gap-2 mb-4">
            <Input
              value={newTodo}
              onChange={setNewTodo}
              placeholder="添加一条待办，回车确认"
              className="flex-1"
            />
            <Button type="submit" className="shrink-0">
              <Plus className="w-4 h-4" />
              添加
            </Button>
          </form>

          <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
            {pendingTodos.length === 0 && completedTodos.length === 0 && (
              <div className="text-center text-sm text-text-secondary py-10">
                暂无待办，添加一条吧
              </div>
            )}

            {pendingTodos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                onToggle={() => handleToggleTodo(todo)}
                onDelete={() => handleDeleteTodo(todo.id)}
              />
            ))}

            {completedTodos.length > 0 && (
              <div className="pt-3 mt-2 border-t border-white/5">
                <div className="flex items-center justify-between mb-1 px-2">
                  <span className="text-xs text-text-secondary">
                    已完成 {completedTodos.length} 项
                  </span>
                  <button
                    onClick={handleClearCompleted}
                    className="text-xs text-text-secondary hover:text-red-400 transition-colors"
                  >
                    清除已完成
                  </button>
                </div>
                {completedTodos.map((todo) => (
                  <TodoRow
                    key={todo.id}
                    todo={todo}
                    onToggle={() => handleToggleTodo(todo)}
                    onDelete={() => handleDeleteTodo(todo.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* ===== Reminders ===== */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold text-white">定时提醒</h2>
            <span className="ml-auto text-xs text-text-secondary">
              {reminders.length} 个待提醒
            </span>
          </div>

          <form onSubmit={handleAddReminder} className="space-y-3 mb-4">
            <Input
              value={reminderTitle}
              onChange={(v) => {
                setReminderTitle(v)
                if (reminderError) setReminderError('')
              }}
              placeholder="提醒我做什么？例如：喝杯水"
            />

            <div className="flex items-end gap-2">
              <Input
                label="多少分钟后提醒"
                type="number"
                value={reminderMinutes}
                onChange={(v) => {
                  setReminderMinutes(v)
                  if (reminderError) setReminderError('')
                }}
                className="flex-1"
              />
              <div className="flex gap-1 pb-0.5">
                {QUICK_MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setReminderMinutes(String(m))}
                    className={`
                      px-2.5 py-1.5 rounded-lg text-xs transition-colors
                      ${Number(reminderMinutes) === m
                        ? 'bg-primary/20 text-primary'
                        : 'bg-white/5 text-text-secondary hover:text-white hover:bg-white/10'}
                    `}
                  >
                    {m}分
                  </button>
                ))}
              </div>
            </div>

            {reminderError && <p className="text-xs text-red-400">{reminderError}</p>}

            <Button type="submit" className="w-full">
              <Clock className="w-4 h-4" />
              添加提醒
            </Button>
          </form>

          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {reminders.length === 0 ? (
              <div className="text-center text-sm text-text-secondary py-10">
                暂无提醒，设定一个时间到点通知你
              </div>
            ) : (
              reminders.map((reminder) => {
                const remaining = reminder.remind_at - now
                return (
                  <div
                    key={reminder.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5"
                  >
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                      <Bell className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-white truncate">{reminder.title}</div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        {formatClock(reminder.remind_at)} · {formatRemaining(remaining)}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteReminder(reminder.id)}
                      title="取消提醒"
                      className="p-1.5 rounded-lg text-text-secondary hover:text-red-400 hover:bg-white/5 transition-colors shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

interface TodoRowProps {
  todo: Todo
  onToggle: () => void
  onDelete: () => void
}

const TodoRow: React.FC<TodoRowProps> = ({ todo, onToggle, onDelete }) => {
  const done = !!todo.is_done
  return (
    <div className="group flex items-start gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
      <button
        onClick={onToggle}
        aria-label={done ? '标记为未完成' : '标记为完成'}
        className={`
          mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center shrink-0
          transition-colors duration-150
          ${done ? 'bg-primary border-primary' : 'border-white/30 hover:border-primary'}
        `}
      >
        {done && <Check className="w-3 h-3 text-slate-900" strokeWidth={3} />}
      </button>

      <span
        className={`flex-1 text-sm leading-relaxed break-words ${
          done ? 'text-text-secondary line-through' : 'text-white'
        }`}
      >
        {todo.title}
      </span>

      <button
        onClick={onDelete}
        title="删除"
        className="p-1 rounded-md text-text-secondary opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export default TodoPage
