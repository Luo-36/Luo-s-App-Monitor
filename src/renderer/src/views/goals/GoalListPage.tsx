import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Target } from 'lucide-react'
import type { Goal, UsageEntry } from '@/types'
import { api } from '@/api/bridge'
import { confirmDialog } from '@/store/useConfirmStore'
import { toast } from '@/store/useToastStore'
import GoalCard from '@/components/cards/GoalCard'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import AddGoalModal from './AddGoalModal'

export const GoalListPage: React.FC = () => {
  const navigate = useNavigate()
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [typeFilter, setTypeFilter] = useState<'all' | 'achievement' | 'restriction'>('all')

  const loadGoals = async () => {
    try {
      setLoading(true)
      const goalList = await api.getGoals()
      setGoals(goalList)
    } catch (err) {
      console.error('Failed to load goals:', err)
    } finally {
      setLoading(false)
    }
  }

  // Update goals' current_progress from live tracking ticks
  const updateProgressFromTick = useCallback((usage: UsageEntry[], liveProg: { programId: number; elapsedSeconds: number } | null) => {
    const totalToday = usage.reduce((s, u) => s + u.total_seconds, 0)
    const usageMap = new Map(usage.map(u => [u.program_id, u.total_seconds]))
    // Add live elapsed time for the currently active program
    if (liveProg) {
      const current = usageMap.get(liveProg.programId) || 0
      usageMap.set(liveProg.programId, current + liveProg.elapsedSeconds)
    }
    const liveTotalToday = totalToday + (liveProg ? liveProg.elapsedSeconds : 0)
    setGoals(prev => prev.map(g => ({
      ...g,
      current_progress: (g.program_ids && g.program_ids.length > 0)
        ? g.program_ids.reduce((sum, pid) => sum + (usageMap.get(pid) ?? 0), 0)
        : liveTotalToday
    })))
  }, [])

  useEffect(() => {
    loadGoals()

    const unsub = api.onTrackingTick((data) => {
      updateProgressFromTick(data.todayUsage, data.currentProgram)
    })

    return () => { unsub() }
  }, [])

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal)
    setShowAddModal(true)
  }

  const handleDelete = async (goal: Goal) => {
    const ok = await confirmDialog({
      title: '删除目标',
      message: `确定要删除目标「${goal.name}」吗？\n已记录的达成爱心不会被收回。`,
      confirmLabel: '删除',
      danger: true
    })
    if (!ok) return
    try {
      await api.deleteGoal(goal.id)
      loadGoals()
      toast.success(`已删除目标「${goal.name}」`)
    } catch (err) {
      console.error('Failed to delete goal:', err)
      toast.error('删除失败，请重试')
    }
  }

  const handleCloseModal = () => {
    setShowAddModal(false)
    setEditingGoal(null)
  }

  const handleSaved = () => {
    loadGoals()
    setEditingGoal(null)
  }

  const achievedToday = useMemo(
    () =>
      goals.filter((goal) => {
        const progress = goal.current_progress ?? 0
        const type = goal.goal_type || 'achievement'
        return type === 'restriction'
          ? progress < goal.daily_limit_seconds
          : progress >= goal.daily_limit_seconds
      }).length,
    [goals]
  )

  const filteredGoals = useMemo(
    () =>
      typeFilter === 'all'
        ? goals
        : goals.filter((goal) => (goal.goal_type || 'achievement') === typeFilter),
    [goals, typeFilter]
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-white">目标</h1>
          {goals.length > 0 && (
            <p className="text-xs text-text-secondary mt-1">
              今日已达成 {achievedToday} / {goals.length} 个目标
            </p>
          )}
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          添加目标
        </Button>
      </div>

      {/* Type filter */}
      {goals.length > 0 && (
        <div className="flex items-center gap-1.5 mb-5">
          {([
            { key: 'all', label: '全部' },
            { key: 'achievement', label: '要求时长' },
            { key: 'restriction', label: '限制时长' }
          ] as const).map((item) => (
            <button
              key={item.key}
              onClick={() => setTypeFilter(item.key)}
              aria-pressed={typeFilter === item.key}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${typeFilter === item.key
                  ? 'bg-primary/20 text-primary'
                  : 'bg-white/5 text-text-secondary hover:text-white hover:bg-white/10'}
              `}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Goal Grid */}
      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-text-secondary" />
          </div>
          <p className="text-text-secondary text-sm mb-2">还没有设置目标</p>
          <p className="text-text-secondary/60 text-xs mb-6">
            设定每日使用时长目标，帮助你合理分配时间
          </p>
          <Button variant="secondary" onClick={() => setShowAddModal(true)}>
            添加第一个目标
          </Button>
        </div>
      ) : filteredGoals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <Target className="w-8 h-8 text-text-secondary" />
          </div>
          <p className="text-text-secondary text-sm mb-5">
            该类型下还没有目标
          </p>
          <Button variant="secondary" onClick={() => setTypeFilter('all')}>
            查看全部目标
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onOpen={() => navigate(`/goals/${goal.id}`)}
              onEdit={() => handleEdit(goal)}
              onDelete={() => handleDelete(goal)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Goal Modal */}
      <AddGoalModal
        isOpen={showAddModal}
        onClose={handleCloseModal}
        onSaved={handleSaved}
        editGoal={editingGoal ?? undefined}
      />
    </div>
  )
}

export default GoalListPage
