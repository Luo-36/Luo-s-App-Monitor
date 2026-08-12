import React, { useEffect } from 'react'
import { useThemeStore } from '@/store/useThemeStore'
import { toFileUrl } from '@/utils/fileUrl'

interface ThemeProviderProps {
  children: React.ReactNode
}

const themeRgbValues: Record<string, { primary: string; light: string; dark: string }> = {
  rose: { primary: '212, 165, 165', light: '224, 192, 192', dark: '180, 130, 130' },
  sage: { primary: '168, 181, 160', light: '194, 204, 188', dark: '138, 152, 130' },
  lavender: { primary: '184, 169, 201', light: '210, 198, 222', dark: '155, 138, 175' },
  sky: { primary: '163, 177, 198', light: '188, 199, 216', dark: '130, 148, 172' },
  peach: { primary: '212, 191, 165', light: '224, 210, 190', dark: '185, 162, 135' },
  taupe: { primary: '184, 176, 160', light: '204, 198, 186', dark: '160, 150, 135' }
}

const themeBgColors: Record<string, string> = {
  rose: '#D4A5A5',
  sage: '#A8B5A0',
  lavender: '#B8A9C9',
  sky: '#A3B1C6',
  peach: '#D4BFA5',
  taupe: '#B8B0A0'
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { themeColor, backgroundImage, dimLevel } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeColor)

    // Also set CSS variables directly on document.documentElement.style for
    // immediate effect. This is more reliable than relying solely on [data-theme]
    // CSS selectors because some CSS contexts might not cascade the attribute
    // selector properly.
    const rgb = themeRgbValues[themeColor]
    if (rgb) {
      document.documentElement.style.setProperty('--primary', rgb.primary)
      document.documentElement.style.setProperty('--primary-light', rgb.light)
      document.documentElement.style.setProperty('--primary-dark', rgb.dark)
    }

    // Set solid background color on body (theme IS the background).
    // BackgroundLayer handles the optional image overlay on top of this
    // solid color, so the image takes visual priority when present.
    document.body.style.backgroundColor = themeBgColors[themeColor] || '#0F172A'
    document.body.style.backgroundImage = 'none'
  }, [themeColor])

  useEffect(() => {
    const url = toFileUrl(backgroundImage)
    if (url) {
      document.documentElement.style.setProperty('--bg-image', `url(${url})`)
    } else {
      document.documentElement.style.removeProperty('--bg-image')
    }
  }, [backgroundImage])

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--bg-dim',
      String(dimLevel)
    )
  }, [dimLevel])

  return <>{children}</>
}

export default ThemeProvider
