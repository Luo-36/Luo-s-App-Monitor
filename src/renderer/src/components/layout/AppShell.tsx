import React from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import BackgroundLayer from '@/components/background/BackgroundLayer'

export const AppShell: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <BackgroundLayer />
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative bg-slate-900/20">
        <Outlet />
      </main>
    </div>
  )
}

export default AppShell
