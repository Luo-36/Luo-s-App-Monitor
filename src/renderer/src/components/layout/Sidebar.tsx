import React, { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Grid3X3,
  BarChart3,
  Target,
  ListTodo,
  Timer,
  User,
  Settings,
  ChevronLeft,
  ChevronRight,
  Heart,
  Activity
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'

const navItems = [
  { to: '/programs', icon: Grid3X3, label: '程序' },
  { to: '/statistics', icon: BarChart3, label: '统计' },
  { to: '/goals', icon: Target, label: '目标' },
  { to: '/todos', icon: ListTodo, label: '待办' },
  { to: '/pomodoro', icon: Timer, label: '番茄钟' },
  { to: '/profile', icon: User, label: '用户' },
  { to: '/settings', icon: Settings, label: '设置' }
]

interface UserInfo {
  nickname: string
  avatar_path: string | null
  hearts_count: number
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分`
  return `${m} 分钟`
}

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [trackingName, setTrackingName] = useState<string | null>(null)
  const [todaySeconds, setTodaySeconds] = useState(0)
  const location = useLocation()

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await api.getProfile()
        setUserInfo({
          nickname: profile.nickname,
          avatar_path: profile.avatar_path,
          hearts_count: profile.hearts_count
        })
      } catch (err) {
        console.error('Failed to load profile:', err)
      }
    }
    loadProfile()

    // Live update when profile changes (e.g., hearts awarded)
    const unsub = api.onProfileUpdated?.((data) => {
      setUserInfo(prev => prev ? { ...prev, hearts_count: data.hearts_count } : prev)
    })

    return () => { unsub?.() }
  }, [location.pathname])

  // Keep a always-visible "what is being tracked right now" summary.
  useEffect(() => {
    let cancelled = false

    api
      .getTodayUsage()
      .then((rows) => {
        if (cancelled) return
        setTodaySeconds(rows.reduce((sum, row) => sum + row.total_seconds, 0))
      })
      .catch(() => {})

    const unsub = api.onTrackingTick((data) => {
      const live = data.currentProgram
      const base = data.todayUsage.reduce((sum, row) => sum + row.total_seconds, 0)
      setTrackingName(live?.programName ?? null)
      setTodaySeconds(base + (live?.elapsedSeconds ?? 0))
    })

    return () => {
      cancelled = true
      unsub()
    }
  }, [])

  const trackingTooltip = trackingName
    ? `正在追踪：${trackingName} · 今日 ${formatDuration(todaySeconds)}`
    : `当前没有活跃程序 · 今日 ${formatDuration(todaySeconds)}`

  return (
    <aside
      className={`
        flex flex-col bg-sidebar/80 backdrop-blur-xl border-r border-white/5
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-[64px]' : 'w-[200px]'}
      `}
    >
      {/* Header with User Info + Collapse */}
      <div className="flex items-center justify-between px-4 h-[72px] border-b border-white/5 shrink-0">
        {!sidebarCollapsed ? (
          <button
            onClick={() => navigate('/profile')}
            title="查看用户主页"
            className="flex items-center gap-3 min-w-0 flex-1 text-left rounded-xl p-1 -m-1 hover:bg-white/5 transition-colors"
          >
            {userInfo ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/20 overflow-hidden shrink-0 ring-2 ring-white/10">
                  {userInfo.avatar_path ? (
                    <img src={toFileUrl(userInfo.avatar_path)!} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-primary text-base font-bold">
                      {userInfo.nickname.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white truncate">{userInfo.nickname}</div>
                  <div className="flex items-center gap-1 text-xs text-pink-400">
                    <Heart className="w-3 h-3 fill-pink-400" />
                    <span>{userInfo.hearts_count}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white/5 animate-pulse" />
                <div className="space-y-1.5">
                  <div className="w-16 h-3 rounded bg-white/5 animate-pulse" />
                  <div className="w-8 h-2.5 rounded bg-white/5 animate-pulse" />
                </div>
              </div>
            )}
          </button>
        ) : (
          <button
            onClick={toggleSidebar}
            aria-label="展开侧边栏"
            title="展开侧边栏"
            className="mx-auto p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            aria-label="收起侧边栏"
            title="收起侧边栏"
            className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={sidebarCollapsed ? item.label : undefined}
            aria-label={item.label}
            className={({ isActive }) =>
              `
              flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
              transition-all duration-200
              ${
                isActive
                  ? 'bg-primary/15 text-primary'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }
              ${sidebarCollapsed ? 'justify-center px-0' : ''}
            `
            }
          >
            <item.icon className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Live tracking status + Version */}
      <div className="px-2 py-2 border-t border-white/5 shrink-0">
        {!sidebarCollapsed ? (
          <div
            title={trackingTooltip}
            className="rounded-xl bg-white/5 border border-white/5 px-3 py-2.5"
          >
            <div className="flex items-center gap-2">
              <span
                className={`
                  w-2 h-2 rounded-full shrink-0
                  ${trackingName ? 'bg-emerald-400 animate-pulse' : 'bg-white/25'}
                `}
              />
              <span className="text-[11px] text-text-secondary">
                {trackingName ? '正在追踪' : '当前无活跃程序'}
              </span>
            </div>
            <div className="mt-1 text-sm text-white truncate">
              {trackingName ?? '等待程序切换…'}
            </div>
            <div className="text-xs text-text-secondary mt-0.5">
              今日 {formatDuration(todaySeconds)}
            </div>
          </div>
        ) : (
          <div className="flex justify-center py-1" title={trackingTooltip}>
            <span
              className={`
                w-2.5 h-2.5 rounded-full
                ${trackingName ? 'bg-emerald-400 animate-pulse' : 'bg-white/25'}
              `}
            />
          </div>
        )}
        {!sidebarCollapsed && (
          <div className="mt-2 px-2 flex items-center gap-1 text-xs text-text-secondary/50">
            <Activity className="w-3 h-3" />
            <span>v1.4.0</span>
          </div>
        )}
      </div>
    </aside>
  )
}

export default Sidebar
