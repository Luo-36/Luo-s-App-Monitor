import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowUpDown, Clock, Timer, PieChart } from 'lucide-react'
import type { ProgramRangeUsage, UsageEntry } from '@/types'
import { api } from '@/api/bridge'
import HorizontalBarChart from '@/components/charts/HorizontalBarChart'
import CategoryPieChart from '@/components/charts/CategoryPieChart'
import Card from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type SortMode = 'today' | 'total'
type SortDir = 'desc' | 'asc'
type CategoryRange = 'today' | 'week' | 'month'

const UNCATEGORIZED = '未分类'

const CATEGORY_COLORS = [
  '#7DD3FC', '#F9A8D4', '#86EFAC', '#FCD34D', '#C4B5FD', '#FB7185',
  '#67E8F9', '#FDBA74', '#BEF264', '#F0ABFC', '#93C5FD', '#FCA5A5'
]

const CATEGORY_RANGE_LABELS: Record<CategoryRange, string> = {
  today: '今日',
  week: '本周',
  month: '本月'
}

function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Inclusive local-date range for the category pie. */
function getRangeDates(range: CategoryRange): { start: string; end: string } {
  const now = new Date()
  const end = localDateStr(now)

  if (range === 'today') return { start: end, end }

  const start = new Date(now)
  if (range === 'week') {
    // Week starts on Monday.
    const offset = (start.getDay() + 6) % 7
    start.setDate(start.getDate() - offset)
  } else {
    start.setDate(1)
  }
  return { start: localDateStr(start), end }
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

export const StatisticsPage: React.FC = () => {
  const navigate = useNavigate()
  const [todayUsage, setTodayUsage] = useState<UsageEntry[]>([])
  const [totalUsage, setTotalUsage] = useState<UsageEntry[]>([])
  const [sortMode, setSortMode] = useState<SortMode>('today')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [loading, setLoading] = useState(true)
  const [categoryRange, setCategoryRange] = useState<CategoryRange>('today')
  const [rangeUsage, setRangeUsage] = useState<ProgramRangeUsage[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

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

  // Category usage for the selected period
  useEffect(() => {
    let cancelled = false
    const { start, end } = getRangeDates(categoryRange)
    api
      .getProgramUsageRange(start, end)
      .then((rows) => {
        if (!cancelled) setRangeUsage(rows)
      })
      .catch((err) => {
        console.error('Failed to load category usage:', err)
      })
    return () => {
      cancelled = true
    }
  }, [categoryRange])

  // For "today", blend in the live tracking values (daily_usage only gets the
  // in-flight session when it ends, so the pie would otherwise lag behind).
  const effectiveRangeUsage = useMemo(() => {
    if (categoryRange !== 'today') return rangeUsage
    const liveById = new Map(todayUsage.map((u) => [u.program_id, u.total_seconds]))
    return rangeUsage.map((row) => ({
      ...row,
      total_seconds: Math.max(row.total_seconds, liveById.get(row.program_id) ?? 0)
    }))
  }, [rangeUsage, todayUsage, categoryRange])

  const categoryTotals = useMemo(() => {
    const totals = new Map<string, number>()
    for (const row of effectiveRangeUsage) {
      if (row.total_seconds <= 0) continue
      const name = (row.category || '').trim() || UNCATEGORIZED
      totals.set(name, (totals.get(name) || 0) + row.total_seconds)
    }
    return [...totals.entries()]
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
  }, [effectiveRangeUsage])

  const categoryTotalSeconds = useMemo(
    () => categoryTotals.reduce((sum, c) => sum + c.seconds, 0),
    [categoryTotals]
  )

  const selectedIndex = useMemo(
    () => categoryTotals.findIndex((c) => c.name === selectedCategory),
    [categoryTotals, selectedCategory]
  )

  const selectedPrograms = useMemo(() => {
    if (selectedIndex < 0) return []
    return effectiveRangeUsage
      .filter(
        (row) =>
          row.total_seconds > 0 &&
          ((row.category || '').trim() || UNCATEGORIZED) === categoryTotals[selectedIndex].name
      )
      .sort((a, b) => b.total_seconds - a.total_seconds)
  }, [effectiveRangeUsage, categoryTotals, selectedIndex])

  // Keep a valid selection whenever the data/range changes.
  useEffect(() => {
    if (categoryTotals.length === 0) {
      setSelectedCategory(null)
      return
    }
    if (!selectedCategory || !categoryTotals.some((c) => c.name === selectedCategory)) {
      setSelectedCategory(categoryTotals[0].name)
    }
  }, [categoryTotals, selectedCategory])

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

      {/* Category analysis */}
      <Card className="p-5 mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <PieChart className="w-5 h-5 text-primary" />
            <div>
              <h2 className="text-base font-semibold text-white">类别时间占比</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                点击饼图扇区查看该类别下各程序的时长
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1">
            {(Object.keys(CATEGORY_RANGE_LABELS) as CategoryRange[]).map((key) => (
              <button
                key={key}
                onClick={() => setCategoryRange(key)}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200
                  ${
                    categoryRange === key
                      ? 'bg-primary/20 text-primary'
                      : 'text-text-secondary hover:text-white hover:bg-white/5'
                  }
                `}
              >
                {CATEGORY_RANGE_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Pie */}
          <div className="w-full lg:w-[320px] h-[260px] shrink-0">
            <CategoryPieChart
              labels={categoryTotals.map((c) => c.name)}
              values={categoryTotals.map((c) => c.seconds)}
              colors={categoryTotals.map(
                (_, i) => CATEGORY_COLORS[i % CATEGORY_COLORS.length]
              )}
              selectedIndex={selectedIndex >= 0 ? selectedIndex : null}
              onSelect={(index) => {
                const cat = categoryTotals[index]
                if (cat) setSelectedCategory(cat.name)
              }}
            />
          </div>

          {/* Breakdown */}
          <div className="flex-1 min-w-0">
            {categoryTotals.length === 0 ? (
              <div className="h-full min-h-[180px] flex items-center justify-center text-sm text-text-secondary">
                该时间段暂无使用数据
              </div>
            ) : (
              <>
                {/* Category chips */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {categoryTotals.map((cat, i) => {
                    const active = cat.name === selectedCategory
                    const pct = categoryTotalSeconds > 0
                      ? Math.round((cat.seconds / categoryTotalSeconds) * 100)
                      : 0
                    return (
                      <button
                        key={cat.name}
                        onClick={() => setSelectedCategory(cat.name)}
                        className={`
                          flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs
                          border transition-all duration-150
                          ${
                            active
                              ? 'border-white/25 bg-white/10 text-white'
                              : 'border-white/5 bg-white/[0.03] text-text-secondary hover:text-white hover:bg-white/5'
                          }
                        `}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                        />
                        <span className="truncate max-w-[120px]">{cat.name}</span>
                        <span className="opacity-60">{pct}%</span>
                      </button>
                    )
                  })}
                </div>

                {/* Programs contributing to the selected category */}
                {selectedIndex >= 0 && (
                  <div className="space-y-3">
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-sm font-medium text-white truncate">
                        {categoryTotals[selectedIndex].name}
                      </span>
                      <span className="text-xs text-text-secondary shrink-0">
                        {formatDuration(categoryTotals[selectedIndex].seconds)}
                      </span>
                    </div>

                    {selectedPrograms.map((p) => {
                      const catSeconds = categoryTotals[selectedIndex].seconds
                      const pct = catSeconds > 0
                        ? Math.round((p.total_seconds / catSeconds) * 100)
                        : 0
                      return (
                        <div key={p.program_id}>
                          <div className="flex items-center justify-between gap-3 text-xs mb-1">
                            <span className="text-white/90 truncate">{p.program_name}</span>
                            <span className="text-text-secondary shrink-0">
                              {formatDuration(p.total_seconds)} · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.max(pct, 1)}%`,
                                backgroundColor: CATEGORY_COLORS[selectedIndex % CATEGORY_COLORS.length]
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}

                    {selectedPrograms.length === 0 && (
                      <div className="text-sm text-text-secondary">该类别暂无程序数据</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
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
