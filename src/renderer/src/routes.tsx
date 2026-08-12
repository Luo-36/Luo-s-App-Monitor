import React, { lazy } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import AppShell from '@/components/layout/AppShell'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const SuspenseWrapper = React.memo(
  ({ children }: { children: React.ReactNode }) => (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center h-full py-32">
          <LoadingSpinner size="md" />
        </div>
      }
    >
      {children}
    </React.Suspense>
  )
)
SuspenseWrapper.displayName = 'SuspenseWrapper'

// Lazy load all view components
const ProgramListPage = lazy(() => import('@/views/programs/ProgramListPage'))
const ProgramDetailPage = lazy(() => import('@/views/programs/ProgramDetailPage'))
const StatisticsPage = lazy(() => import('@/views/statistics/StatisticsPage'))
const GoalListPage = lazy(() => import('@/views/goals/GoalListPage'))
const GoalDetailPage = lazy(() => import('@/views/goals/GoalDetailPage'))
const ProfilePage = lazy(() => import('@/views/profile/ProfilePage'))
const PomodoroTimerPage = lazy(() => import('@/views/pomodoro/PomodoroTimerPage'))
const SettingsPage = lazy(() => import('@/views/settings/SettingsPage'))

export const router = createHashRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: <Navigate to="/programs" replace />
      },
      {
        path: 'programs',
        element: (
          <SuspenseWrapper>
            <ProgramListPage />
          </SuspenseWrapper>
        )
      },
      {
        path: 'programs/:id',
        element: (
          <SuspenseWrapper>
            <ProgramDetailPage />
          </SuspenseWrapper>
        )
      },
      {
        path: 'statistics',
        element: (
          <SuspenseWrapper>
            <StatisticsPage />
          </SuspenseWrapper>
        )
      },
      {
        path: 'goals',
        element: (
          <SuspenseWrapper>
            <GoalListPage />
          </SuspenseWrapper>
        )
      },
      {
        path: 'goals/:id',
        element: (
          <SuspenseWrapper>
            <GoalDetailPage />
          </SuspenseWrapper>
        )
      },
      {
        path: 'profile',
        element: (
          <SuspenseWrapper>
            <ProfilePage />
          </SuspenseWrapper>
        )
      },
      {
        path: 'pomodoro',
        element: (
          <SuspenseWrapper>
            <PomodoroTimerPage />
          </SuspenseWrapper>
        )
      },
      {
        path: 'settings',
        element: (
          <SuspenseWrapper>
            <SettingsPage />
          </SuspenseWrapper>
        )
      }
    ]
  }
])

export default router
