import React from 'react'
import { useThemeStore } from '@/store/useThemeStore'
import { toFileUrl } from '@/utils/fileUrl'

export const BackgroundLayer: React.FC = () => {
  const { backgroundImage, dimLevel } = useThemeStore()

  if (!backgroundImage) return null

  const imgUrl = toFileUrl(backgroundImage)
  // dimLevel: 0 = no dimming, 1 = fully black
  const dimOpacity = Math.min(0.85, Math.max(0, dimLevel))

  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      {/* Use an <img> rather than a CSS background: Chromium may defer
          background-image requests for occluded layers, which left the
          backdrop blank on cold starts. */}
      {imgUrl && (
        <img
          src={imgUrl}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {/* Dark overlay for readability */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: `rgba(15, 23, 42, ${dimOpacity})`,
        }}
      />
    </div>
  )
}

export default BackgroundLayer
