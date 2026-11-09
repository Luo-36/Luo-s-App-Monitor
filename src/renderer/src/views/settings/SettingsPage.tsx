import React, { useEffect, useState, useRef } from 'react'
import {
  Palette,
  Image,
  Monitor,
  ZoomIn,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Database
} from 'lucide-react'
import { api } from '@/api/bridge'
import { useThemeStore } from '@/store/useThemeStore'
import { toast } from '@/store/useToastStore'
import { confirmDialog } from '@/store/useConfirmStore'
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
  const [cropImageSrc, setCropImageSrc] = useState('')
  const [cropping, setCropping] = useState(false)
  const [pendingCropPath, setPendingCropPath] = useState<string | null>(null)
  const dimSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scaleSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const profile = await api.getProfile()
        // Normalize theme color: if the DB contains an invalid value, fall back.
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

        const auto = await api.getAutoStart()
        setLocalAutoStart(auto)
      } catch (err) {
        console.error('Failed to load settings:', err)
        toast.error('读取设置失败')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  /** Apply the GUI scale via Electron page zoom (keeps viewport layout sane). */
  const applyGuiScale = (scale: number) => {
    api.setZoomFactor(scale / 100)
  }

  // Simple appearance choices apply and save immediately, so navigating away
  // can never leave the app thinking a different theme than the database.
  const handleThemeChange = (colorKey: string) => {
    setLocalThemeColor(colorKey)
    theme.setThemeColor(colorKey)
    api.updateProfile({ theme_color: colorKey }).catch((err) => {
      console.error('Failed to persist theme color:', err)
    })
  }

  const handleFloatingBallColorChange = (colorKey: string) => {
    setLocalFloatingBallColor(colorKey)
    api.updateProfile({ floating_ball_color: colorKey }).catch((err) => {
      console.error('Failed to persist floating ball color:', err)
    })
  }

  const handleDimChange = (dim: number) => {
    setLocalDimLevel(dim)
    theme.setDimLevel(dim)
    if (dimSaveTimer.current) clearTimeout(dimSaveTimer.current)
    dimSaveTimer.current = setTimeout(() => {
      api.updateProfile({ background_dim: dim }).catch((err) => {
        console.error('Failed to persist background dim:', err)
      })
    }, 300)
  }

  const handleAutoStartChange = async (enabled: boolean) => {
    setLocalAutoStart(enabled)
    try {
      await api.setAutoStart(enabled)
      await api.updateProfile({ auto_start: enabled ? 1 : 0 })
      toast.success(enabled ? '已开启开机自启' : '已关闭开机自启')
    } catch (err) {
      console.error('Failed to set auto-start:', err)
      setLocalAutoStart(!enabled)
      toast.error('开机自启设置失败')
    }
  }

  const handleGuiScaleChange = (scale: number) => {
    setLocalGuiScale(scale)
    applyGuiScale(scale)
    if (scaleSaveTimer.current) clearTimeout(scaleSaveTimer.current)
    scaleSaveTimer.current = setTimeout(() => {
      api.updateProfile({ gui_scale: scale }).catch((err) => {
        console.error('Failed to persist GUI scale:', err)
      })
    }, 300)
  }

  const handleCancelBackground = async () => {
    setLocalBackgroundImage(null)
    theme.setBackgroundImage(null)
    try {
      await api.updateProfile({ background_image_path: null })
      toast.success('已移除背景图')
    } catch (err) {
      console.error('Failed to clear background:', err)
      toast.error('移除背景失败，请重试')
    }
  }

  const handleBackgroundUpload = async () => {
    const filePath = await api.openFileDialog([
      { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }
    ])
    if (!filePath) return

    const dataUrl = await api.readFileAsBase64(filePath)
    if (!dataUrl) return
    const savedPath = await api.saveImage(dataUrl, 'background', `bg_${Date.now()}.png`)

    setPendingCropPath(savedPath)
    setCropImageSrc(dataUrl)
    setCropping(true)
  }

  const handleCropComplete = async (cropData: CropData) => {
    try {
      const srcPath = pendingCropPath
      if (!srcPath) return

      const outName = `bg_cropped_${Date.now()}`
      const result = await api.cropImage(
        srcPath, outName,
        Math.round(cropData.x), Math.round(cropData.y),
        Math.round(cropData.width), Math.round(cropData.height)
      )

      if (result) {
        setLocalBackgroundImage(result)
        theme.setBackgroundImage(result)
        await api.updateProfile({ background_image_path: result })
        toast.success('背景图已更新')
      } else {
        toast.error('背景裁剪失败，请重试')
      }
      setCropping(false)
      setCropImageSrc('')
      setPendingCropPath(null)
    } catch (err) {
      console.error('[Settings] Crop failed:', err)
      toast.error('背景裁剪失败，请重试')
    }
  }

  const handleReset = async () => {
    const ok = await confirmDialog({
      title: '恢复默认设置',
      message: '主题、背景、缩放与开机自启都会恢复为默认值。此操作会立即生效。',
      confirmLabel: '恢复默认'
    })
    if (!ok) return

    setLocalThemeColor(DEFAULT_THEME_COLOR)
    setLocalFloatingBallColor(DEFAULT_THEME_COLOR)
    setLocalBackgroundImage(DEFAULT_BACKGROUND_IMAGE)
    setLocalDimLevel(DEFAULT_DIM_LEVEL)
    setLocalAutoStart(DEFAULT_AUTO_START)
    setLocalGuiScale(DEFAULT_GUI_SCALE)

    theme.setThemeColor(DEFAULT_THEME_COLOR)
    theme.setBackgroundImage(DEFAULT_BACKGROUND_IMAGE)
    theme.setDimLevel(DEFAULT_DIM_LEVEL)
    applyGuiScale(DEFAULT_GUI_SCALE)

    try {
      await api.updateProfile({
        theme_color: DEFAULT_THEME_COLOR,
        floating_ball_color: DEFAULT_THEME_COLOR,
        background_image_path: null,
        background_dim: DEFAULT_DIM_LEVEL,
        gui_scale: DEFAULT_GUI_SCALE,
        auto_start: 0
      })
      await api.setAutoStart(DEFAULT_AUTO_START)
      toast.success('已恢复默认设置')
    } catch (err) {
      console.error('Failed to reset settings:', err)
      toast.error('恢复默认失败，请重试')
    }
  }

  const handleExport = async () => {
    try {
      const path = await api.exportData()
      if (path) toast.success(`已导出到 ${path}`)
    } catch (err) {
      console.error('Failed to export data:', err)
      toast.error('导出失败，请重试')
    }
  }

  const handleImport = async () => {
    const ok = await confirmDialog({
      title: '导入数据',
      message: '导入将覆盖当前所有数据（程序、目标、使用记录等），且不可撤销。确定继续吗？',
      confirmLabel: '导入并覆盖',
      danger: true
    })
    if (!ok) return
    try {
      const imported = await api.importData()
      if (imported) toast.success('数据导入成功，请重启应用以完全生效')
    } catch (err) {
      console.error('Failed to import data:', err)
      toast.error('导入失败：备份文件格式无效')
    }
  }

  const handleClearData = async () => {
    const ok = await confirmDialog({
      title: '清除所有统计数据',
      message:
        '这将删除：\n· 所有使用时长记录\n· 所有目标完成记录\n· 所有番茄钟记录\n· 所有爱心\n\n此操作不可撤销！',
      confirmLabel: '全部清除',
      danger: true
    })
    if (!ok) return
    try {
      await api.clearAllData()
      toast.success('所有统计数据已清除')
    } catch (err) {
      console.error('Failed to clear data:', err)
      toast.error('清除失败，请重试')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const ballPreviewColor =
    themeColors.find((item) => item.key === localFloatingBallColor)?.color ??
    themeColors[0].color

  return (
    <div className="p-6 max-w-[700px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">设置</h1>
        <p className="text-xs text-text-secondary mt-1">
          主题、悬浮球颜色、遮罩、缩放、背景与开机自启都会即时生效并自动保存。
        </p>
      </div>

      {/* Theme Color Section */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-base font-semibold text-white">主题色</h2>
        </div>
        <p className="text-xs text-text-secondary -mt-3 mb-4">
          主题色用作强调色与纯色底；设置背景图后会覆盖纯色底，二者可以共存。
        </p>

        <div className="flex gap-4 flex-wrap">
          {themeColors.map((item) => (
            <button
              key={item.key}
              onClick={() => handleThemeChange(item.key)}
              aria-pressed={localThemeColor === item.key}
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
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <h2 className="text-base font-semibold text-white">悬浮球色</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-secondary">预览</span>
            <div
              className="w-9 h-9 rounded-full border-2 border-white/20 shadow-lg"
              style={{ backgroundColor: ballPreviewColor }}
            />
          </div>
        </div>
        <p className="text-xs text-text-secondary -mt-3 mb-4">
          选择番茄钟悬浮球的显示颜色（上传了悬浮球背景图时以图片为准）
        </p>

        <div className="flex gap-4 flex-wrap">
          {themeColors.map((item) => (
            <button
              key={item.key}
              onClick={() => handleFloatingBallColorChange(item.key)}
              aria-pressed={localFloatingBallColor === item.key}
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
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="text-sm text-white">背景图片</span>
              <p className="text-xs text-text-secondary mt-0.5">
                支持 PNG / JPG，上传后可裁剪并调整遮罩强度
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
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
                label={`遮罩强度 ${Math.round(localDimLevel * 100)}%`}
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

      {/* Data Management */}
      <Card className="p-6 mb-6">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <Database className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">数据管理</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              备份、恢复或清理本机数据
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Button variant="secondary" className="w-full" onClick={handleExport}>
            <Download className="w-4 h-4" />
            导出数据 (JSON)
          </Button>
          <Button variant="secondary" className="w-full" onClick={handleImport}>
            <Upload className="w-4 h-4" />
            导入数据
          </Button>
          <div className="pt-2 mt-2 border-t border-white/5">
            <Button variant="secondary" className="w-full" onClick={handleReset}>
              <RotateCcw className="w-4 h-4" />
              恢复默认设置
            </Button>
          </div>
          <Button variant="danger" className="w-full" onClick={handleClearData}>
            <Trash2 className="w-4 h-4" />
            清除所有统计数据
          </Button>
        </div>
      </Card>

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
