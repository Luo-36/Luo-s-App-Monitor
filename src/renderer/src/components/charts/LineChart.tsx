import React, { useMemo } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import type { DailyUsage } from '@/types'
import { useThemeStore } from '@/store/useThemeStore'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface LineChartProps {
  data: DailyUsage[]
  onPointClick?: (date: string) => void
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function formatHours(seconds: number): string {
  const h = Math.round((seconds / 3600) * 10) / 10
  return `${h} 小时`
}

export const LineChart: React.FC<LineChartProps> = ({ data, onPointClick }) => {
  const sortedData = useMemo(() => {
    const sorted = [...data]
    sorted.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return sorted
  }, [data])

  const labels = useMemo(() => sortedData.map((d) => formatDate(d.date)), [sortedData])
  const values = useMemo(
    () => sortedData.map((d) => Math.round((d.total_seconds / 3600) * 10) / 10),
    [sortedData]
  )

  // Read primary color from CSS variable so it follows the selected theme
  const themeColor = useThemeStore((s) => s.themeColor)
  const primaryRgb = useMemo(() => {
    if (typeof document !== 'undefined') {
      const value = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim()
      return value || '59, 130, 246'
    }
    return '59, 130, 246'
  }, [themeColor])

  const chartData = {
    labels,
    datasets: [
      {
        label: '使用时长 (小时)',
        data: values,
        fill: true,
        backgroundColor: (ctx: {
          chart: { ctx: CanvasRenderingContext2D }
          dataIndex?: number
        }) => {
          const canvas = ctx.chart.ctx
          const gradient = canvas.createLinearGradient(0, 0, 0, 200)
          gradient.addColorStop(0, `rgba(${primaryRgb}, 0.3)`)
          gradient.addColorStop(1, `rgba(${primaryRgb}, 0.01)`)
          return gradient
        },
        borderColor: `rgb(${primaryRgb})`,
        borderWidth: 2,
        tension: 0.4,
        pointBackgroundColor: `rgb(${primaryRgb})`,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: `rgb(${primaryRgb})`,
        pointHoverBorderWidth: 3
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        titleColor: 'rgb(248, 250, 252)',
        bodyColor: 'rgb(148, 163, 184)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: { raw: number }) => `${context.raw} 小时`
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)',
          display: false
        },
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: { size: 11 },
          maxTicksLimit: 10
        }
      },
      y: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: { size: 11 },
          callback: (value: number) => `${value}h`
        }
      }
    },
    onClick: (_: unknown, elements: { datasetIndex: number; index: number }[]) => {
      if (elements.length > 0 && onPointClick) {
        const index = elements[0].index
        const dateStr = sortedData[index]?.date
        if (dateStr) onPointClick(dateStr)
      }
    }
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-secondary text-sm">
        暂无使用数据
      </div>
    )
  }

  return (
    <div className="w-full h-64">
      <Line data={chartData} options={options} />
    </div>
  )
}

export default LineChart
