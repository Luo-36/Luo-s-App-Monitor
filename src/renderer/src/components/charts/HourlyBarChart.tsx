import React, { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js'
import { useThemeStore } from '@/store/useThemeStore'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

interface HourlyBarChartProps {
  /** 24 entries of seconds, index 0 = 00:00–01:00. */
  data: number[]
}

function getPrimaryRgb(): string {
  if (typeof document !== 'undefined') {
    return (
      getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() ||
      '59, 130, 246'
    )
  }
  return '59, 130, 246'
}

/** Axis labels must never show more than two decimal places. */
function formatTick(value: number | string): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  return String(Math.round(num * 100) / 100)
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

export const HourlyBarChart: React.FC<HourlyBarChartProps> = ({ data }) => {
  const themeColor = useThemeStore((s) => s.themeColor)
  const primaryRgb = useMemo(() => getPrimaryRgb(), [themeColor])

  const labels = useMemo(
    () => Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}时`),
    []
  )

  const values = useMemo(
    () =>
      Array.from({ length: 24 }, (_, h) =>
        Math.round(((data[h] || 0) / 60) * 100) / 100
      ),
    [data]
  )

  const chartData = {
    labels,
    datasets: [
      {
        label: '使用时长 (分钟)',
        data: values,
        backgroundColor: `rgba(${primaryRgb}, 0.7)`,
        borderColor: `rgb(${primaryRgb})`,
        borderWidth: 1,
        borderRadius: 3,
        maxBarThickness: 22
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.9)',
        titleColor: 'rgb(248, 250, 252)',
        bodyColor: 'rgb(148, 163, 184)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const seconds = data[context.dataIndex] || 0
            return formatDuration(seconds)
          }
        }
      }
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: { size: 10 },
          autoSkip: true,
          maxTicksLimit: 12,
          maxRotation: 0
        }
      },
      y: {
        grid: { color: 'rgba(148, 163, 184, 0.1)' },
        beginAtZero: true,
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: { size: 11 },
          callback: (value: number | string) => `${formatTick(value)}m`
        }
      }
    }
  }

  return (
    <div className="w-full h-56">
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default HourlyBarChart
