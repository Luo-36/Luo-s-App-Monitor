import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Clock, Timer } from 'lucide-react'
import type { UsageEntry } from '@/types'
import { api } from '@/api/bridge'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type SortMode = 'today' | 'total'
type SortDir = 'desc' | 'asc'

export const StatisticsPage: React.FC = () => {
  const navigate = useNavigate()
  const [todayUsage, setTodayUsage] = useState<UsageEntry[]>([])
  const [totalUsage, setTotalUsage] = useState<UsageEntry[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('today')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [today, total] = await Promise.all([
          api.getTodayUsage(),
          api.getTotalUsage()
        ])
        setTodayUsage(today)
        setTotalUsage(total)
      } catch (err) {
        console.error('Failed to load statistics:', err)
      } finally {
        setLoading(false)
      }
    }
    load()

    // Live update on tracking ticks
    const unsub = api.onTrackingTick((data) => {
      if (data.todayUsage.length > 0) {
        const merged = data.todayUsage.map(u => ({ ...u }))
        const cp = data.currentProgram
        if (cp) {
          const idx = merged.findIndex(u => u.program_id === cp.programId)
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], total_seconds: merged[idx].total_seconds + cp.elapsedSeconds }
          }
        }
        setTodayUsage(merged)
      }
    })
    return () => { unsub() }
  }, [])

  const displayData = sortMode === 'today' ? todayUsage : totalUsage

  const handleBarClick = (programId: number) => {
    navigate(`/programs/${programId}`)
  }

  const toggleSortMode = () => {
    setSortMode((prev) => (prev === 'today' ? 'total' : 'today'))
  }

  const toggleSortDir = () => {
    setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">使用统计</h1>
      </div>

      {/* Sort Controls */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleSortMode}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              transition-all duration-200
              ${
                sortMode === 'today'
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }
            `}
          >
            <Clock className="w-4 h-4" />
            今日时长
          </button>

          <button
            onClick={toggleSortMode}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              transition-all duration-200
              ${
                sortMode === 'total'
                  ? 'bg-primary/20 text-primary'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }
            `}
          >
            <Timer className="w-4 h-4" />
            总时长
          </button>

          <div className="flex-1" />

          <button
            onClick={toggleSortDir}
            className="
              flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              text-text-secondary hover:text-white hover:bg-white/5
              transition-all duration-200
            "
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortDir === 'desc' ? '降序' : '升序'}
          </button>
        </div>
      </Card>

      {/* Chart */}
      <Card className="p-4">
        <HorizontalBarChart
          data={displayData}
          sortAscending={sortDir === 'asc'}
          onBarClick={handleBarClick}
        />
      </Card>

      {/* Usage Summary */}
      {displayData.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-secondary text-sm">暂无使用数据</p>
          <p className="text-text-secondary/60 text-xs mt-2">
            启动你要监控的程序后，数据将自动显示
          </p>
        </div>
      )}
    </div>
  )
}

export default StatisticsPage
