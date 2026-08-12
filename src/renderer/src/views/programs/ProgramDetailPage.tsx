import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Clock, BarChart3, Calendar } from 'lucide-react'
import type { Program, DailyUsage } from '@/types'
import { api } from '@/api/bridge'
import LineChart from '@/components/charts/LineChart'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

type RangeTab = '7d' | '30d'

export const ProgramDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [program, setProgram] = useState<Program | null>(null)
  const [usageData, setUsageData] = useState<DailyUsage[]>([])
  const [range, setRange] = useState<RangeTab>('7d')
  const [todaySeconds, setTodaySeconds] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      setLoading(true)
      try {
        const prog = await api.getProgram(Number(id))
        setProgram(prog)

        const [usage, todayUsage] = await Promise.all([
          api.getProgramUsage(Number(id), range),
          api.getTodayUsage()
        ])
        setUsageData(usage)

        const today = todayUsage.find((u) => u.program_id === Number(id))
        setTodaySeconds(today?.total_seconds ?? 0)
      } catch (err) {
        console.error('Failed to load program detail:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, range])

  const formatDuration = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (h > 0) return `${h} 小时 ${m} 分钟`
    return `${m} 分钟`
  }

  const getWeekTotal = (): number => {
    return usageData.reduce((sum, d) => sum + d.total_seconds, 0)
  }

  const getDailyAvg = (): number => {
    if (usageData.length === 0) return 0
    return Math.round(getWeekTotal() / usageData.length)
  }

  if (loading || !program) {
    return (
      <div className="flex items-center justify-center h-full py-32">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-[1000px] mx-auto">
      {/* Back Button */}
      <button
        onClick={() => navigate('/programs')}
        className="flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm">返回</span>
      </button>

      {/* Program Header */}
      <div className="flex items-center gap-4 mb-6">
        {program.icon_path && (
          <img
            src={`file://${program.icon_path}`}
            alt={program.name}
            className="w-14 h-14 rounded-2xl bg-white/10"
          />
        )}
        {!program.icon_path && (
          <div className="w-14 h-14 rounded-2xl bg-primary/20 flex items-center justify-center">
            <span className="text-2xl font-bold text-primary">
              {program.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{program.name}</h1>
          <p className="text-sm text-text-secondary">{program.process_name}</p>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 mb-6">
        {(['7d', '30d'] as RangeTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setRange(tab)}
            className={`
              px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200
              ${
                range === tab
                  ? 'bg-primary text-white'
                  : 'text-text-secondary hover:text-white hover:bg-white/5'
              }
            `}
          >
            {tab === '7d' ? '最近 7 天' : '最近 30 天'}
          </button>
        ))}
      </div>

      {/* Line Chart */}
      <Card className="p-4 mb-6">
        <LineChart data={usageData} />
      </Card>

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">今日使用</p>
            <p className="text-lg font-semibold text-white">
              {formatDuration(todaySeconds)}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">
              {range === '7d' ? '本周总计' : '本月总计'}
            </p>
            <p className="text-lg font-semibold text-white">
              {formatDuration(getWeekTotal())}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-text-secondary">日均</p>
            <p className="text-lg font-semibold text-white">
              {formatDuration(getDailyAvg())}
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ProgramDetailPage
