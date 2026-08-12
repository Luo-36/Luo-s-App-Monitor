import React, { Suspense, useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import ThemeProvider from '@/components/ThemeProvider'
import BackgroundLayer from '@/components/background/BackgroundLayer'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { router } from './routes'
import { api } from '@/api/bridge'
import { useThemeStore } from '@/store/useThemeStore'

const App: React.FC = () => {
  useEffect(() => {
    // Load saved settings from profile and apply on startup
    api.getProfile()
      .then((profile) => {
        const store = useThemeStore.getState()

        // Restore background image
        if (profile.background_image_path) {
          store.setBackgroundImage(profile.background_image_path)
        }

        // Restore dim level
        if (profile.background_dim !== undefined && profile.background_dim !== null) {
          store.setDimLevel(profile.background_dim)
        }

        // Restore theme color
        if (profile.theme_color) {
          store.setThemeColor(profile.theme_color)
        }

        // Apply GUI scale via root font-size
        const scale = (profile.gui_scale ?? 100) / 100
        document.documentElement.style.fontSize = `${16 * scale}px`
      })
      .catch(() => {})
  }, [])

  return (
    <ThemeProvider>
      <BackgroundLayer />
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-screen bg-slate-900">
            <LoadingSpinner size="lg" />
          </div>
        }
      >
        <RouterProvider router={router} />
      </Suspense>
    </ThemeProvider>
  )
}

export default App
