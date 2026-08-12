import React, { useEffect, useState, useCallback } from 'react'
import {
  Play,
  Pause,
  Square,
  Settings2,
  Disc3,
  History
} from 'lucide-react'
import type { PomodoroConfig } from '@/types'
import { api } from '@/api/bridge'
import { usePomodoroStore } from '@/store/usePomodoroStore'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Switch from '@/components/ui/Switch'
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

export const PomodoroTimerPage: React.FC = () => {
  const pomodoro = usePomodoroStore()
  const [activePreset, setActivePreset] = useState<PresetKey>('default')
  const [customConfig, setCustomConfig] = useState<PomodoroConfig>(presets.default.config)
  const [showCustom, setShowCustom] = useState(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[800px] mx-auto">
      {/* Header */}
      <h1 className="text-2xl font-bold text-white mb-6">番茄钟</h1>

      {/* Timer Display */}
      <Card className="p-8 mb-6 text-center">
        {/* Phase Label */}
        <p
          className={`text-lg font-medium mb-2 ${phaseColors[pomodoro.phase] || 'text-primary'}`}
        >
          {phaseLabels[pomodoro.phase] || '工作中'}
        </p>

        {/* Timer */}
        <div className="text-7xl font-mono font-bold text-white tracking-wider mb-4">
          {formatTime(pomodoro.remainingSeconds)}
        </div>

        {/* Cycle Progress */}
        {pomodoro.status !== 'idle' && (
          <p className="text-sm text-text-secondary mb-6">
            第 {pomodoro.currentCycle}/{pomodoro.totalCycles} 轮
          </p>
        )}

        {/* Controls */}
        <div className="flex items-center justify-center gap-4">
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
      </Card>

      {/* Presets */}
      <Card className="p-6 mb-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">预设</h3>
        <div className="flex gap-3">
          {(Object.keys(presets) as PresetKey[]).map((key) => (
            <button
              key={key}
              onClick={() => handlePresetChange(key)}
              className={`
                px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
                ${
                  activePreset === key
                    ? 'bg-primary text-white'
                    : 'text-text-secondary hover:text-white hover:bg-white/5'
                }
              `}
            >
              {presets[key].label}
            </button>
          ))}
        </div>
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

      {/* Floating Ball Settings */}
      <Card className="p-6 mb-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">悬浮球</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-white">启用悬浮球</span>
            <Switch
              checked={pomodoro.floatingBallEnabled}
              onChange={handleFloatingBallToggle}
            />
          </div>

          {pomodoro.floatingBallEnabled && (
            <p className="text-xs text-text-secondary/60">番茄钟运行时，悬浮球将显示在桌面最顶层</p>
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
