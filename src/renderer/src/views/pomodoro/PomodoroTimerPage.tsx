import React, { useEffect, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  Square,
  Settings2,
  Disc3,
  History,
  ImagePlus,
  Trash2
} from 'lucide-react'
import type { PomodoroConfig } from '@/types'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'
import { usePomodoroStore } from '@/store/usePomodoroStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
import Slider from '@/components/ui/Slider'
import Input from '@/components/ui/Input'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type PresetKey = 'default' | 'long' | 'custom'

const presets: Record<PresetKey, { label: string; config: PomodoroConfig }> = {
  default: {
    label: '25/5 (默认)',
    config: { workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, cycles: 4 }
  },
  long: {
    label: '50/10 (长)',
    config: { workMinutes: 50, breakMinutes: 10, longBreakMinutes: 20, cycles: 3 }
  },
  custom: {
    label: '自定义',
    config: { workMinutes: 25, breakMinutes: 5, longBreakMinutes: 15, cycles: 4 }
  }
}

const phaseLabels: Record<string, string> = {
  work: '工作',
  break: '休息',
  long_break: '长休息'
}

const phaseColors: Record<string, string> = {
  work: 'text-primary',
  break: 'text-emerald-400',
  long_break: 'text-amber-400'
}

const phaseStrokeColors: Record<string, string> = {
  work: 'stroke-primary',
  break: 'stroke-emerald-400',
  long_break: 'stroke-amber-400'
}

const ballColors: Record<string, string> = {
  rose: '#D4A5A5',
  sage: '#A8B5A0',
  lavender: '#B8A9C9',
  sky: '#A3B1C6',
  peach: '#D4BFA5',
  taupe: '#B8B0A0'
}

const RING_RADIUS = 128
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export const PomodoroTimerPage: React.FC = () => {
  const pomodoro = usePomodoroStore()
  const [activePreset, setActivePreset] = useState<PresetKey>('default')
  const [customConfig, setCustomConfig] = useState<PomodoroConfig>(presets.default.config)
  const [showCustom, setShowCustom] = useState(false)
  const [ballImage, setBallImage] = useState<string | null>(null)
  const [ballColor, setBallColor] = useState('taupe')
  const [ballSize, setBallSize] = useState(72)
  const [ballShape, setBallShape] = useState<'circle' | 'square'>('circle')
  const [uploadingBallImage, setUploadingBallImage] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const state = await api.getPomodoroState()
        if (state) {
          pomodoro.updateFromMain(state)
        }
        const profile = await api.getProfile()

        // Sync floating ball enabled state from the actual window (source of truth)
        try {
          const fbEnabled = await api.getFloatingBallEnabled()
          pomodoro.setFloatingBallEnabled(fbEnabled)
        } catch (err) {
          console.error('Failed to sync floating ball state:', err)
          // Fall back to profile value
          pomodoro.setFloatingBallEnabled(!!profile.pomodoro_floating_ball_enabled)
        }

        // Load custom config from profile
        const customCfg: PomodoroConfig = {
          workMinutes: profile.pomodoro_work_minutes || 25,
          breakMinutes: profile.pomodoro_break_minutes || 5,
          longBreakMinutes: profile.pomodoro_long_break_minutes || 15,
          cycles: profile.pomodoro_cycles || 4
        }
        setCustomConfig(customCfg)
        setBallImage(profile.pomodoro_floating_ball_image ?? null)
        setBallColor(profile.floating_ball_color || 'taupe')
        setBallSize(profile.pomodoro_ball_size || 72)
        setBallShape(profile.pomodoro_ball_shape === 'square' ? 'square' : 'circle')
      } catch (err) {
        console.error('Failed to load pomodoro state:', err)
      } finally {
        setLoading(false)
      }
    }
    load()

    const unsubTick = api.onPomodoroTick((state) => {
      pomodoro.updateFromMain(state)
    })

    return () => {
      unsubTick()
    }
  }, [])

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleStart = useCallback(() => {
    const config =
      activePreset === 'custom' ? customConfig : presets[activePreset].config
    api.startPomodoro(config)

    // Save custom config to profile when starting
    if (activePreset === 'custom') {
      api.updateProfile({
        pomodoro_work_minutes: customConfig.workMinutes,
        pomodoro_break_minutes: customConfig.breakMinutes,
        pomodoro_long_break_minutes: customConfig.longBreakMinutes,
        pomodoro_cycles: customConfig.cycles,
      }).catch((err) => {
        console.error('Failed to save pomodoro config to profile:', err)
      })
    }
  }, [activePreset, customConfig])

  const handlePause = useCallback(() => {
    api.pausePomodoro()
  }, [])

  const handleResume = useCallback(() => {
    api.resumePomodoro()
  }, [])

  const handleStop = useCallback(() => {
    api.stopPomodoro()
    pomodoro.reset()
  }, [])

  const handlePresetChange = (key: PresetKey) => {
    setActivePreset(key)
    setShowCustom(key === 'custom')
  }

  const handleCustomConfigChange = (field: keyof PomodoroConfig, value: string) => {
    const num = parseInt(value) || 0
    setCustomConfig((prev) => ({ ...prev, [field]: num }))
  }

  const handleFloatingBallToggle = useCallback(async (enabled: boolean) => {
    pomodoro.setFloatingBallEnabled(enabled)
    try {
      const result = await api.setFloatingBallEnabled(enabled)
      // Persist to profile so it survives restart
      api.updateProfile({ pomodoro_floating_ball_enabled: result ? 1 : 0 })
        .catch(err => console.error('Failed to persist floating ball state:', err))
    } catch (err) {
      console.error('Failed to toggle floating ball:', err)
    }
  }, [])

  const handleUploadBallImage = async () => {
    setUploadingBallImage(true)
    try {
      const filePath = await api.openFileDialog([
        { name: '图片文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }
      ])
      if (!filePath) return

      const dataUrl = await api.readFileAsBase64(filePath)
      if (!dataUrl) return

      const extMatch = /\.([a-zA-Z0-9]+)$/.exec(filePath)
      const ext = extMatch ? extMatch[1].toLowerCase() : 'png'
      const savedPath = await api.saveImage(
        dataUrl,
        'floating',
        `pomo_ball_${Date.now()}.${ext}`
      )
      await api.updateProfile({ pomodoro_floating_ball_image: savedPath })
      setBallImage(savedPath)
    } catch (err) {
      console.error('Failed to upload floating ball image:', err)
    } finally {
      setUploadingBallImage(false)
    }
  }

  const handleClearBallImage = async () => {
    try {
      await api.updateProfile({ pomodoro_floating_ball_image: null })
      setBallImage(null)
    } catch (err) {
      console.error('Failed to clear floating ball image:', err)
    }
  }

  const handleBallSizeChange = (size: number) => {
    setBallSize(size)
    api.updateProfile({ pomodoro_ball_size: size }).catch((err) => {
      console.error('Failed to save floating ball size:', err)
    })
  }

  const handleBallShapeChange = (shape: 'circle' | 'square') => {
    setBallShape(shape)
    api.updateProfile({ pomodoro_ball_shape: shape }).catch((err) => {
      console.error('Failed to save floating ball shape:', err)
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const activeConfig =
    activePreset === 'custom' ? customConfig : presets[activePreset].config
  const progress =
    pomodoro.totalSeconds > 0
      ? Math.min(
          1,
          Math.max(
            0,
            (pomodoro.totalSeconds - pomodoro.remainingSeconds) /
              pomodoro.totalSeconds
          )
        )
      : 0
  const nextPhaseText =
    pomodoro.phase === 'work'
      ? pomodoro.currentCycle >= pomodoro.totalCycles
        ? `长休息 ${activeConfig.longBreakMinutes} 分钟`
        : `休息 ${activeConfig.breakMinutes} 分钟`
      : `工作 ${activeConfig.workMinutes} 分钟`

  // Idle timers should preview the upcoming work duration instead of 00:00.
  const displaySeconds =
    pomodoro.status === 'idle'
      ? activeConfig.workMinutes * 60
      : pomodoro.remainingSeconds

  return (
    <div className="p-6 max-w-[800px] mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white mb-6">番茄钟</h1>

      {/* Timer Display */}
      <Card className="p-8 mb-6 text-center">
        <div className="relative w-[280px] h-[280px] mx-auto">
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 280 280"
            aria-hidden="true"
          >
            <circle
              cx="140"
              cy="140"
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="10"
            />
            <circle
              cx="140"
              cy="140"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
              className={`${phaseStrokeColors[pomodoro.phase] || 'stroke-primary'} transition-[stroke-dashoffset] duration-500 ease-linear`}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p
              className={`text-sm font-medium mb-1 ${phaseColors[pomodoro.phase] || 'text-primary'}`}
            >
              {phaseLabels[pomodoro.phase] || '工作中'}
            </p>
            <div className="text-6xl font-bold text-white tracking-wider tabular-nums">
              {formatTime(displaySeconds)}
            </div>
            {pomodoro.status !== 'idle' && (
              <p className="text-xs text-text-secondary mt-2">
                第 {pomodoro.currentCycle}/{pomodoro.totalCycles} 轮
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mt-5">
          {pomodoro.status === 'idle' && (
            <Button size="lg" onClick={handleStart}>
              <Play className="w-5 h-5" />
              开始
            </Button>
          )}
          {pomodoro.status === 'running' && (
            <Button size="lg" variant="secondary" onClick={handlePause}>
              <Pause className="w-5 h-5" />
              暂停
            </Button>
          )}
          {pomodoro.status === 'paused' && (
            <>
              <Button size="lg" onClick={handleResume}>
                <Play className="w-5 h-5" />
                继续
              </Button>
              <Button variant="ghost" onClick={handleStop}>
                <Square className="w-4 h-4" />
                停止
              </Button>
            </>
          )}
          {pomodoro.status === 'running' && (
            <Button variant="ghost" onClick={handleStop}>
              <Square className="w-4 h-4" />
              停止
            </Button>
          )}
        </div>

        {pomodoro.status !== 'idle' && (
          <p className="text-xs text-text-secondary mt-4">
            下一阶段：{nextPhaseText}
          </p>
        )}
      </Card>

      {/* Presets + custom config are only editable while idle, so the timer
          view stays focused during a running session. */}
      {pomodoro.status === 'idle' && (
        <>
          <Card className="p-6 mb-6">
            <h3 className="text-sm font-medium text-text-secondary mb-4">预设</h3>
            <div className="flex flex-wrap gap-3">
              {(Object.keys(presets) as PresetKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => handlePresetChange(key)}
                  aria-pressed={activePreset === key}
                  className={`
                    px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                    ${
                      activePreset === key
                        ? 'bg-primary text-slate-900'
                        : 'text-text-secondary hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  {presets[key].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-text-secondary mt-3">
              工作 {activeConfig.workMinutes} 分 · 休息 {activeConfig.breakMinutes} 分 ·
              长休息 {activeConfig.longBreakMinutes} 分 · {activeConfig.cycles} 轮
            </p>
          </Card>

          {/* Custom Config */}
          {showCustom && (
            <Card className="p-6 mb-6">
              <div className="flex items-center gap-2 mb-4">
                <Settings2 className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-medium text-text-secondary">自定义配置</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="工作时长 (分钟)"
                  value={customConfig.workMinutes.toString()}
                  onChange={(v) => handleCustomConfigChange('workMinutes', v)}
                  type="number"
                />
                <Input
                  label="休息时长 (分钟)"
                  value={customConfig.breakMinutes.toString()}
                  onChange={(v) => handleCustomConfigChange('breakMinutes', v)}
                  type="number"
                />
                <Input
                  label="长休息时长 (分钟)"
                  value={customConfig.longBreakMinutes.toString()}
                  onChange={(v) => handleCustomConfigChange('longBreakMinutes', v)}
                  type="number"
                />
                <Input
                  label="轮数"
                  value={customConfig.cycles.toString()}
                  onChange={(v) => handleCustomConfigChange('cycles', v)}
                  type="number"
                />
              </div>
            </Card>
          )}
        </>
      )}

      {/* Floating Ball Settings */}
      <Card className="p-6 mb-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">悬浮球</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-10 h-10 shrink-0 overflow-hidden border border-white/10 bg-white/10"
                style={{
                  borderRadius: ballShape === 'circle' ? '9999px' : '12px',
                  backgroundColor: ballImage
                    ? undefined
                    : ballColors[ballColor] || ballColors.taupe
                }}
              >
                {ballImage && (
                  <img
                    src={toFileUrl(ballImage) || ''}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-white">启用悬浮球</div>
                <div className="text-xs text-text-secondary">
                  {pomodoro.floatingBallEnabled
                    ? '番茄钟运行时显示在桌面最顶层'
                    : '关闭后不显示桌面悬浮球'}
                </div>
              </div>
            </div>
            <Switch
              checked={pomodoro.floatingBallEnabled}
              onChange={handleFloatingBallToggle}
            />
          </div>

          {pomodoro.floatingBallEnabled && (
            <>
              <div className="pt-4 border-t border-white/5">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm text-white">悬浮球背景</p>
                    <p className="text-xs text-text-secondary mt-0.5">
                      支持透明 PNG；未设置时使用悬浮球颜色
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {ballImage && (
                      <Button variant="ghost" size="sm" onClick={handleClearBallImage}>
                        <Trash2 className="w-4 h-4" />
                        清除
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleUploadBallImage}
                      loading={uploadingBallImage}
                    >
                      <ImagePlus className="w-4 h-4" />
                      上传
                    </Button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-white/5 space-y-3">
                <Slider
                  label="悬浮球大小"
                  value={ballSize}
                  onChange={handleBallSizeChange}
                  min={48}
                  max={140}
                  step={4}
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">悬浮球形状</span>
                  <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
                    {(['circle', 'square'] as const).map((shape) => (
                      <button
                        key={shape}
                        onClick={() => handleBallShapeChange(shape)}
                        aria-pressed={ballShape === shape}
                        className={`
                          px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                          ${
                            ballShape === shape
                              ? 'bg-primary/20 text-primary'
                              : 'text-text-secondary hover:text-white hover:bg-white/5'
                          }
                        `}
                      >
                        {shape === 'circle' ? '圆形' : '方形'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </Card>

      {/* Recent Sessions */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-text-secondary" />
          <h3 className="text-sm font-medium text-text-secondary">历史记录</h3>
        </div>

        {pomodoro.recentSessions.length === 0 ? (
          <p className="text-sm text-text-secondary/60 text-center py-4">
            暂无记录
          </p>
        ) : (
          <div className="space-y-2">
            {pomodoro.recentSessions.map((session, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 px-3 rounded-xl bg-white/5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-medium ${
                      phaseColors[session.phase]
                    }`}
                  >
                    {phaseLabels[session.phase]}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-secondary">
                    {formatTime(session.durationSeconds)}
                  </span>
                  <span className="text-xs text-text-secondary/60">
                    {session.completedAt}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

export default PomodoroTimerPage
