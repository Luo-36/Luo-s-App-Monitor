import React, { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Target } from 'lucide-react'
import type { Goal, UsageEntry } from '@/types'
import { api } from '@/api/bridge'
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
    if (window.confirm(`确定要删除目标「${goal.name}」吗？`)) {
      try {
        await api.deleteGoal(goal.id)
        loadGoals()
      } catch (err) {
        console.error('Failed to delete goal:', err)
      }
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">目标</h1>
        <Button onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          添加目标
        </Button>
      </div>

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
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <div
              key={goal.id}
              onClick={() => navigate(`/goals/${goal.id}`)}
              className="cursor-pointer"
            >
              <GoalCard
                goal={goal}
                onEdit={() => handleEdit(goal)}
                onDelete={() => handleDelete(goal)}
              />
            </div>
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
