import React, { useEffect, useState, useRef } from 'react'
import { Palette, Image, Monitor, ZoomIn } from 'lucide-react'
import { api } from '@/api/bridge'
import { useThemeStore } from '@/store/useThemeStore'
import { toFileUrl } from '@/utils/fileUrl'
import Card from '@/components/ui/Card'
import Switch from '@/components/ui/Switch'
import Slider from '@/components/ui/Slider'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import ImageCropper from '@/components/image/ImageCropper'
import type { CropData } from '@/types'

const themeColors = [
  { key: 'rose', label: '粉', color: '#D4A5A5' },
  { key: 'sage', label: '绿', color: '#A8B5A0' },
  { key: 'lavender', label: '紫', color: '#B8A9C9' },
  { key: 'sky', label: '蓝', color: '#A3B1C6' },
  { key: 'peach', label: '橙', color: '#D4BFA5' },
  { key: 'taupe', label: '灰', color: '#B8B0A0' }
] as const

const knownThemeKeys = themeColors.map(c => c.key)

const DEFAULT_THEME_COLOR = 'taupe'
const DEFAULT_BACKGROUND_IMAGE: string | null = null
const DEFAULT_DIM_LEVEL = 0.35
const DEFAULT_AUTO_START = false
const DEFAULT_GUI_SCALE = 100

export const SettingsPage: React.FC = () => {
  const theme = useThemeStore()
  const [localThemeColor, setLocalThemeColor] = useState<string>('taupe')
  const [localFloatingBallColor, setLocalFloatingBallColor] = useState<string>('taupe')
  const [localBackgroundImage, setLocalBackgroundImage] = useState<string | null>(null)
  const [localDimLevel, setLocalDimLevel] = useState(0.35)
  const [localAutoStart, setLocalAutoStart] = useState(false)
  const [localGuiScale, setLocalGuiScale] = useState(DEFAULT_GUI_SCALE)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const messageTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const initialBackgroundRef = useRef<string | null>(null)
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [cropping, setCropping] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const profile = await api.getProfile()
        // Normalize theme color: if the DB contains an invalid value (e.g. old hex color),
        // fall back to 'taupe'
        const keys = knownThemeKeys as readonly string[]
        setLocalThemeColor(
          keys.includes(profile.theme_color) ? profile.theme_color : DEFAULT_THEME_COLOR
        )
        setLocalFloatingBallColor(
          keys.includes(profile.floating_ball_color) ? profile.floating_ball_color : DEFAULT_THEME_COLOR
        )
        setLocalBackgroundImage(profile.background_image_path)
        setLocalDimLevel(profile.background_dim ?? 0.35)
        setLocalGuiScale(profile.gui_scale ?? DEFAULT_GUI_SCALE)
        initialBackgroundRef.current = profile.background_image_path

        const auto = await api.getAutoStart()
        setLocalAutoStart(auto)
      } catch (err) {
        console.error('Failed to load settings:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const showMessage = (msg: string) => {
    setSaveMessage(msg)
    if (messageTimerRef.current) clearTimeout(messageTimerRef.current)
    messageTimerRef.current = setTimeout(() => setSaveMessage(''), 3000)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Step 1: Handle background image copy
      let bgPath = localBackgroundImage
      const bgChanged = localBackgroundImage !== initialBackgroundRef.current
      if (
        bgChanged &&
        localBackgroundImage &&
        !localBackgroundImage.startsWith('data:') &&
        !localBackgroundImage.startsWith('http://') &&
        !localBackgroundImage.startsWith('https://') &&
        !localBackgroundImage.startsWith('file://')
      ) {
        try {
          const savedPath = await api.saveBackgroundImage(localBackgroundImage)
          if (savedPath) {
            bgPath = savedPath
          }
        } catch (err) {
          console.error('Failed to copy background image:', err)
          showMessage('背景图片复制失败，请重试')
          return
        }
      }

      // Step 2: Apply theme color (sets solid background color via ThemeProvider)
      theme.setThemeColor(localThemeColor as typeof themeColors[number]['key'])

      // Step 3: Apply background image and dim level
      theme.setBackgroundImage(bgPath)
      theme.setDimLevel(localDimLevel)

      // Step 4: Apply GUI scale via root font-size (scales rem-based sizes)
      document.documentElement.style.fontSize = `${16 * (localGuiScale / 100)}px`

      // Step 5: Persist to database
      try {
        await api.updateProfile({
          theme_color: localThemeColor,
          floating_ball_color: localFloatingBallColor,
          background_image_path: bgPath,
          background_dim: localDimLevel,
          gui_scale: localGuiScale,
          auto_start: localAutoStart ? 1 : 0
        })
      } catch (err) {
        console.error('Failed to persist profile:', err)
        showMessage('保存到数据库失败，请重试')
        return
      }

      // Step 6: Persist auto-start setting
      try {
        await api.setAutoStart(localAutoStart)
      } catch (err) {
        console.error('Failed to set auto-start:', err)
        showMessage('开机自启设置失败')
        return
      }

      // Update local state with the persisted background path
      if (bgPath !== localBackgroundImage) {
        setLocalBackgroundImage(bgPath)
        initialBackgroundRef.current = bgPath
      }

      showMessage('设置已保存')
    } catch (err) {
      console.error('Unexpected error saving settings:', err)
      showMessage('保存失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    const confirmed = window.confirm('确定要恢复默认设置吗？当前未保存的更改将丢失。')
    if (!confirmed) return

    setLocalThemeColor(DEFAULT_THEME_COLOR)
    setLocalFloatingBallColor(DEFAULT_THEME_COLOR)
    setLocalBackgroundImage(DEFAULT_BACKGROUND_IMAGE)
    setLocalDimLevel(DEFAULT_DIM_LEVEL)
    setLocalAutoStart(DEFAULT_AUTO_START)
    setLocalGuiScale(DEFAULT_GUI_SCALE)
    showMessage('已恢复默认设置，请点击"保存设置"以生效')
  }

  const handleThemeChange = (colorKey: string) => {
    setLocalThemeColor(colorKey)
    // Theme IS the background — selecting a theme clears the background image
    setLocalBackgroundImage(null)
  }

  const handleFloatingBallColorChange = (colorKey: string) => {
    setLocalFloatingBallColor(colorKey)
  }

  const handleCancelBackground = () => {
    setLocalBackgroundImage(null)
  }

  const [pendingCropPath, setPendingCropPath] = useState<string | null>(null)

  const handleBackgroundUpload = async () => {
    const filePath = await api.openFileDialog([
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
    ])
    if (!filePath) return

    // Save original image first, then offer cropping
    const dataUrl = await api.readFileAsBase64(filePath)
    if (!dataUrl) return
    const savedPath = await api.saveImage(dataUrl, 'background', `bg_${Date.now()}.png`)
    console.log('[Settings] Saved original:', savedPath)

    setPendingCropPath(savedPath)
    setCropImageSrc(dataUrl)
    setCropping(true)
  }

  const handleCropComplete = async (cropData: CropData) => {
    try {
      const srcPath = pendingCropPath
      if (!srcPath) { console.error('[Settings] No pending crop path'); return }

      console.log('[Settings] Cropping via main process:', srcPath, cropData)

      const outName = `bg_cropped_${Date.now()}`
      const result = await api.cropImage(
        srcPath, outName,
        Math.round(cropData.x), Math.round(cropData.y),
        Math.round(cropData.width), Math.round(cropData.height)
      )

      if (result) {
        console.log('[Settings] Crop result:', result)
        setLocalBackgroundImage(result)
      } else {
        console.error('[Settings] Crop returned null')
      }
      setCropping(false)
      setCropImageSrc('')
      setPendingCropPath(null)
    } catch (err) {
      console.error('[Settings] Crop failed:', err)
    }
  }

  const handleDimChange = (dim: number) => {
    setLocalDimLevel(dim)
  }

  const handleAutoStartChange = (enabled: boolean) => {
    setLocalAutoStart(enabled)
  }

  const handleGuiScaleChange = (scale: number) => {
    setLocalGuiScale(scale)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[700px] mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white mb-6">设置</h1>

      {/* Theme Color Section */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-white">主题色</h2>
        </div>
        <p className="text-xs text-text-secondary -mt-3 mb-4">选择主题色后，将作为纯色背景，同时清除背景图片</p>

        <div className="flex gap-4">
          {themeColors.map((item) => (
            <button
              key={item.key}
              onClick={() => handleThemeChange(item.key)}
              className="flex flex-col items-center gap-2 group"
              title={item.label}
            >
              <div
                className={`
                  w-10 h-10 rounded-full transition-all duration-200
                  ${
                    localThemeColor === item.key
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110'
                      : 'hover:scale-110'
                  }
                `}
                style={{ backgroundColor: item.color }}
              />
              <span
                className={`
                  text-xs
                  ${
                    localThemeColor === item.key
                      ? 'text-white font-medium'
                      : 'text-text-secondary'
                  }
                `}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Floating Ball Color Section */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-white">悬浮球色</h2>
        </div>
        <p className="text-xs text-text-secondary -mt-3 mb-4">选择番茄钟悬浮球的显示颜色</p>

        <div className="flex gap-4">
          {themeColors.map((item) => (
            <button
              key={item.key}
              onClick={() => handleFloatingBallColorChange(item.key)}
              className="flex flex-col items-center gap-2 group"
              title={item.label}
            >
              <div
                className={`
                  w-10 h-10 rounded-full transition-all duration-200
                  ${
                    localFloatingBallColor === item.key
                      ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110'
                      : 'hover:scale-110'
                  }
                `}
                style={{ backgroundColor: item.color }}
              />
              <span
                className={`
                  text-xs
                  ${
                    localFloatingBallColor === item.key
                      ? 'text-white font-medium'
                      : 'text-text-secondary'
                  }
                `}
              >
                {item.label}
              </span>
            </button>
          ))}
        </div>
      </Card>

      {/* Background Section */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Image className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-white">背景设置</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white">背景图片</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={handleCancelBackground}>
                取消背景
              </Button>
              <Button variant="secondary" size="sm" onClick={handleBackgroundUpload}>
                上传图片
              </Button>
            </div>
          </div>

          {localBackgroundImage && (
            <>
              <div
                className="w-full h-32 rounded-xl bg-cover bg-center border border-white/10"
                style={{ backgroundImage: `url(${toFileUrl(localBackgroundImage)})` }}
              />
              <Slider
                label={`模糊程度 ${Math.round(localDimLevel * 100)}%`}
                value={localDimLevel * 100}
                onChange={(v) => handleDimChange(v / 100)}
                min={10}
                max={100}
                step={5}
              />
            </>
          )}
        </div>
      </Card>

      {/* GUI Scale Section */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <ZoomIn className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-white">界面缩放</h2>
        </div>

        <Slider
          label={`缩放比例 ${localGuiScale}%`}
          value={localGuiScale}
          onChange={handleGuiScaleChange}
          min={75}
          max={150}
          step={5}
        />
      </Card>

      {/* Auto Start Section */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-white">开机自启</h2>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-white">开机自动启动</p>
            <p className="text-xs text-text-secondary mt-0.5">
              开启后，开机时将自动运行
            </p>
          </div>
          <Switch checked={localAutoStart} onChange={handleAutoStartChange} />
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex flex-col items-center gap-3 pt-2 pb-8">
        {saveMessage && (
          <p
            className={`text-sm ${
              saveMessage.includes('失败') ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {saveMessage}
          </p>
        )}
        <Button
          variant="secondary"
          onClick={handleReset}
          className="w-full max-w-xs py-3 text-base"
        >
          恢复默认设置
        </Button>
        <Button onClick={handleSave} loading={saving} className="w-full max-w-xs py-3 text-base">
          保存设置
        </Button>
        <div className="pt-4 border-t border-white/10 w-full max-w-xs">
          <Button
            variant="danger"
            className="w-full py-2.5 text-sm"
            onClick={async () => {
              if (window.confirm('确定要清除所有统计数据吗？\n\n这将删除：\n· 所有使用时长记录\n· 所有目标完成记录\n· 所有番茄钟记录\n· 所有爱心\n\n此操作不可撤销！')) {
                await api.clearAllData()
                showMessage('所有统计数据已清除')
              }
            }}
          >
            清除所有统计数据
          </Button>
        </div>
      </div>

      {/* Image Cropper for background */}
      {cropImageSrc && (
        <ImageCropper
          isOpen={cropping}
          onClose={() => {
            setCropping(false)
            setCropImageSrc('')
          }}
          imageSrc={cropImageSrc}
          aspectRatio={16 / 9}
          onCropComplete={handleCropComplete}
        />
      )}
    </div>
  )
}

export default SettingsPage
