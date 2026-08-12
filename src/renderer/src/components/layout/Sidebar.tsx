import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Grid3X3,
  BarChart3,
  Target,
  Timer,
  User,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { useAppStore } from '@/store/useAppStore'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'

const navItems = [
  { to: '/programs', icon: Grid3X3, label: '程序' },
  { to: '/statistics', icon: BarChart3, label: '统计' },
  { to: '/goals', icon: Target, label: '目标' },
  { to: '/pomodoro', icon: Timer, label: '番茄钟' },
  { to: '/profile', icon: User, label: '用户' },
  { to: '/settings', icon: Settings, label: '设置' }
]

interface UserInfo {
  nickname: string
  avatar_path: string | null
  hearts_count: number
}

export const Sidebar: React.FC = () => {
  const { sidebarCollapsed, toggleSidebar } = useAppStore()
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
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
          <div className="flex items-center gap-3 min-w-0 flex-1">
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
                  <div className="text-xs text-pink-400">♥ {userInfo.hearts_count}</div>
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
          </div>
        ) : (
          <button
            onClick={toggleSidebar}
            className="mx-auto p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-text-secondary hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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

      {/* Version */}
      {!sidebarCollapsed && (
        <div className="px-4 py-3 border-t border-white/5">
          <span className="text-xs text-text-secondary/50">v1.0.0</span>
        </div>
      )}
    </aside>
  )
}

export default Sidebar
