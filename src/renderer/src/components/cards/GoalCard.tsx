import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle, AlertTriangle, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Goal } from '@/types'
import { getGoalTypeLabel } from '@/types'
import { toFileUrl } from '@/utils/fileUrl'

interface GoalCardProps {
  goal: Goal
  onEdit?: () => void
  onDelete?: () => void
}

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

export const GoalCard: React.FC<GoalCardProps> = React.memo(({ goal, onEdit, onDelete }) => {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const goalType = goal.goal_type || 'achievement'
  const progress = goal.current_progress ?? 0
  const isRestriction = goalType === 'restriction'
  const isExceeded = isRestriction && progress >= goal.daily_limit_seconds
  const isCompleted = !isRestriction && progress >= goal.daily_limit_seconds
  const progressPercent = Math.min(
    100,
    goal.daily_limit_seconds > 0
      ? Math.round((progress / goal.daily_limit_seconds) * 100)
      : 0
  )

  const cardBg = goal.card_image_path
    ? `url(${toFileUrl(goal.card_image_path)})`
    : undefined

  return (
    <div
      className="
        relative overflow-hidden rounded-2xl
        bg-slate-800/60 border border-white/10
        hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10
        transition-all duration-300
        aspect-[4/3] group
      "
    >
      {/* Background */}
      {cardBg ? (
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
          style={{ backgroundImage: cardBg }}
        />
      ) : (
        <div
          className={`absolute inset-0 bg-gradient-to-br ${getGradientColors(goal.id)}`}
        />
      )}

      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/95 via-slate-900/50 to-transparent" />

      {/* Type Badge */}
      <div className="absolute top-3 left-3">
        <span
          className={`
            inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium
            ${isRestriction
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-primary/20 text-primary border border-primary/30'
            }
          `}
        >
          {getGoalTypeLabel(goalType)}
        </span>
      </div>

      {/* Status Icon */}
      {isRestriction ? (
        isExceeded && (
          <div className="absolute top-3 right-3">
            <AlertTriangle className="w-6 h-6 text-red-400 drop-shadow-lg" />
          </div>
        )
      ) : (
        isCompleted && (
          <div className="absolute top-3 right-3">
            <CheckCircle className="w-6 h-6 text-emerald-400 drop-shadow-lg" />
          </div>
        )
      )}

      {/* Edit/Delete Dropdown */}
      <div
        ref={dropdownRef}
        className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
      >
        <button
          onClick={(e) => {
            e.stopPropagation()
            setShowDropdown((prev) => !prev)
          }}
          className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm text-white/80 hover:text-white hover:bg-black/60 transition-colors"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {showDropdown && (
          <div className="absolute right-0 mt-1 w-28 bg-slate-800 border border-white/10 rounded-xl shadow-xl overflow-hidden z-20">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(false)
                onEdit?.()
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-white/10 w-full transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              编辑
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setShowDropdown(false)
                onDelete?.()
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-white/10 w-full transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              删除
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        <h3 className="text-base font-semibold text-white drop-shadow-sm">
          {goal.name}
        </h3>

        {goal.description && (
          <p className="text-xs text-text-secondary/80 line-clamp-1">
            {goal.description}
          </p>
        )}

        {/* Progress Section */}
        {isRestriction ? (
          /* Restriction: show under/over limit status */
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className={isExceeded ? 'text-red-400 font-medium' : 'text-emerald-400 font-medium'}>
                {isExceeded ? '已超限' : '未超限'}
              </span>
              <span className="text-white/70">
                {isExceeded
                  ? `超出 ${formatDuration(progress - goal.daily_limit_seconds)}`
                  : `剩余 ${formatDuration(goal.daily_limit_seconds - progress)}`
                }
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`
                  h-full rounded-full transition-all duration-500 ease-out
                  ${isExceeded ? 'bg-red-500' : 'bg-emerald-400'}
                `}
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
          </div>
        ) : (
          /* Achievement: show progress toward goal */
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/70">
                {formatDuration(progress)} / {formatDuration(goal.daily_limit_seconds)}
              </span>
              <span className="text-primary font-medium">{progressPercent}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={`
                  h-full rounded-full transition-all duration-500 ease-out
                  ${isCompleted ? 'bg-emerald-400' : 'bg-primary'}
                `}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

GoalCard.displayName = 'GoalCard'

export default GoalCard
