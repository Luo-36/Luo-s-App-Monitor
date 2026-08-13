import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, Calendar, CheckCircle2, AlertTriangle, Target } from 'lucide-react'
import type { Goal, DailyUsage, GoalCompletion } from '@/types'
import { getGoalTypeLabel } from '@/types'
import { api } from '@/api/bridge'
import { toFileUrl } from '@/utils/fileUrl'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

function getGradientColors(id: number): string {
  const gradients = [
    'from-rose-500/30 to-pink-600/30',
    'from-blue-500/30 to-indigo-600/30',
    'from-amber-500/30 to-orange-600/30',
    'from-emerald-500/30 to-teal-600/30',
    'from-violet-500/30 to-purple-600/30',
    'from-cyan-500/30 to-sky-600/30'
  ]
  return gradients[id % gradients.length]
}

export const GoalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [goal, setGoal] = useState<Goal | null>(null)
  const [weeklyData, setWeeklyData] = useState<DailyUsage[]>([])
  const [completionsCount, setCompletionsCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const g = await api.getGoal(Number(id))
        setGoal(g)

        // Load 7 days of usage, summed across all associated programs
        const programIds = g?.program_ids ?? []
        if (programIds.length > 0) {
          const usages = await Promise.all(
            programIds.map((pid) => api.getProgramUsage(pid, '7d'))
          )
          const dateMap = new Map<string, number>()
          for (const usage of usages) {
            for (const day of usage) {
              dateMap.set(day.date, (dateMap.get(day.date) ?? 0) + day.total_seconds)
            }
          }
          const merged: DailyUsage[] = Array.from(dateMap.entries())
            .map(([date, total_seconds]) => ({ date, total_seconds }))
            .sort((a, b) => a.date.localeCompare(b.date))
          setWeeklyData(merged)
        } else {
          setWeeklyData([])
        }

        // Load actual goal completions from DB for accurate count
        const completions: GoalCompletion[] = await api.getGoalCompletions(Number(id))
        setCompletionsCount(completions.length)
      } catch (err) {
        console.error('Failed to load goal detail:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading || !goal) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const goalType = goal.goal_type || 'achievement'
  const isRestriction = goalType === 'restriction'
  const progress = goal.current_progress ?? 0
  const isExceeded = isRestriction && progress >= goal.daily_limit_seconds
  const isCompleted = !isRestriction && progress >= goal.daily_limit_seconds

  // For restriction: remaining allowed time (negative if exceeded)
  const remainingSeconds = isRestriction ? goal.daily_limit_seconds - progress : 0

  // Progress percentage (for restriction, cap at 100 to show how much of the limit is used)
  const progressPercent = Math.min(
    100,
    goal.daily_limit_seconds > 0
      ? Math.round((progress / goal.daily_limit_seconds) * 100)
      : 0
  )

  // Achievement/restriction days count comes from actual goal_completions records
  const achievedDays = completionsCount

  // Max weekly seconds for chart scaling
  const maxWeeklySeconds = Math.max(...weeklyData.map((d) => d.total_seconds), 1)

  const cardBg = goal.card_image_path
    ? `url(${toFileUrl(goal.card_image_path)})`
    : undefined

  return (
    <div className="p-6 max-w-[800px] mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/goals')}
        className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">返回</span>
      </button>

      {/* Goal Header Image */}
      <div
        className="
          relative w-full h-48 rounded-2xl overflow-hidden mb-6
          bg-slate-800/60 border border-white/10
        "
      >
        {cardBg ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: cardBg }}
          />
        ) : (
          <div
            className={`absolute inset-0 bg-gradient-to-br ${getGradientColors(goal.id)}`}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4">
          <h1 className="text-2xl font-bold text-white">{goal.name}</h1>
          {goal.description && (
            <p className="text-sm text-text-secondary mt-1">{goal.description}</p>
          )}
        </div>

        {/* Type Badge */}
        <div className="absolute top-4 left-4">
          <span
            className={`
              inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
              ${isRestriction
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : 'bg-primary/20 text-primary border border-primary/30'
              }
            `}
          >
            <Target className="w-3.5 h-3.5" />
            {getGoalTypeLabel(goalType)}
          </span>
        </div>

        {/* Status Badge */}
        {isRestriction ? (
          isExceeded ? (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1.5 bg-red-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-red-500/30">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-red-400">已超限</span>
              </div>
            </div>
          ) : (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">未超限</span>
              </div>
            </div>
          )
        ) : (
          isCompleted && (
            <div className="absolute top-4 right-4">
              <div className="flex items-center gap-1.5 bg-emerald-500/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-emerald-500/30">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-medium text-emerald-400">今日已完成</span>
              </div>
            </div>
          )
        )}
      </div>

      {/* Stats Grid */}
      {isRestriction ? (
        /* Restriction stats: remaining time, days under limit */
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">剩余时间</p>
              <p className={`text-lg font-semibold ${isExceeded ? 'text-red-400' : 'text-white'}`}>
                {isExceeded ? '已超限' : formatDuration(remainingSeconds)}
              </p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">未超限天数</p>
              <p className="text-lg font-semibold text-white">{achievedDays} 天</p>
            </div>
          </Card>
        </div>
      ) : (
        /* Achievement stats: progress %, days achieved */
        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">今日进度</p>
              <p className="text-lg font-semibold text-white">{progressPercent}%</p>
            </div>
          </Card>

          <Card className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-text-secondary">达成天数</p>
              <p className="text-lg font-semibold text-white">{achievedDays} 天</p>
            </div>
          </Card>
        </div>
      )}

      {/* Progress Bar */}
      <Card className="p-6 mb-6">
        <h3 className="text-sm font-medium text-text-secondary mb-4">
          {isRestriction ? '使用进度' : '每日进度'}
        </h3>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <div className="w-full h-4 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  isRestriction
                    ? isExceeded
                      ? 'bg-red-500'
                      : 'bg-emerald-400'
                    : isCompleted
                      ? 'bg-emerald-400'
                      : 'bg-primary'
                }`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
          <span className="text-sm font-medium text-white shrink-0">
            {isRestriction ? (
              <span className={isExceeded ? 'text-red-400' : 'text-emerald-400'}>
                {formatDuration(progress)} / {formatDuration(goal.daily_limit_seconds)}
              </span>
            ) : (
              <span>
                {formatDuration(progress)} / {formatDuration(goal.daily_limit_seconds)}
              </span>
            )}
          </span>
        </div>
      </Card>

      {/* Mini Weekly Chart */}
      {weeklyData.length > 0 && (
        <Card className="p-6">
          <h3 className="text-sm font-medium text-text-secondary mb-4">过去 7 天</h3>
          <div className="flex items-end gap-2 h-32">
            {weeklyData.map((day, idx) => {
              const heightPercent = Math.max(
                5,
                (day.total_seconds / maxWeeklySeconds) * 100
              )
              const date = new Date(day.date)
              const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`
              const isDayAchieved = isRestriction
                ? day.total_seconds < goal.daily_limit_seconds
                : day.total_seconds >= goal.daily_limit_seconds

              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-text-secondary">
                    {formatDuration(day.total_seconds)}
                  </span>
                  <div
                    className={`
                      w-full rounded-md transition-all duration-300
                      ${
                        isDayAchieved
                          ? 'bg-emerald-400/60'
                          : isRestriction
                            ? 'bg-red-400/60'
                            : 'bg-primary/40 hover:bg-primary/60'
                      }
                    `}
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                  />
                  <span className="text-[10px] text-text-secondary">{dayLabel}</span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

export default GoalDetailPage
