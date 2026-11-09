import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Bell, X } from 'lucide-react'
import Sidebar from './Sidebar'
import { api } from '@/api/bridge'

export const AppShell: React.FC = () => {
  const [toastTitle, setToastTitle] = useState<string | null>(null)

  useEffect(() => {
    // In-app fallback for reminders: shown when the app window is open,
    // even if Windows suppresses the system notification.
    const unsub = api.onReminderFired((title) => setToastTitle(title))
    return () => { unsub() }
  }, [])

  useEffect(() => {
    if (toastTitle === null) return
    const timer = setTimeout(() => setToastTitle(null), 10000)
    return () => clearTimeout(timer)
  }, [toastTitle])

  return (
    <div className="relative z-10 flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative bg-slate-900/20">
        <Outlet />
      </main>

      {/* Reminder toast */}
      {toastTitle !== null && (
        <div className="fixed top-4 right-4 z-50 max-w-sm">
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-800/95 backdrop-blur-xl border border-primary/30 shadow-2xl">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-text-secondary">定时提醒</div>
              <div className="text-sm text-white break-words mt-0.5">{toastTitle}</div>
            </div>
            <button
              onClick={() => setToastTitle(null)}
              className="p-1 rounded-md text-text-secondary hover:text-white hover:bg-white/10 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AppShell
