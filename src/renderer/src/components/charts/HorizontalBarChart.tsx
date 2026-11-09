import React, { useMemo } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import type { UsageEntry } from '@/types'
import { useThemeStore } from '@/store/useThemeStore'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

/** Read --primary CSS variable value (e.g. "59, 130, 246") */
function getPrimaryRgb(): string {
  if (typeof document !== 'undefined') {
    return getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '59, 130, 246'
  }
  return '59, 130, 246'
}

interface HorizontalBarChartProps {
  data: UsageEntry[]
  sortAscending?: boolean
  onBarClick?: (programId: number) => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

/** Axis labels must never show more than two decimal places. */
function formatTick(value: number | string): string {
  const num = Number(value)
  if (!Number.isFinite(num)) return String(value)
  return String(Math.round(num * 100) / 100)
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  data,
  sortAscending = false,
  onBarClick
}) => {
  const sortedData = useMemo(() => {
    const sorted = [...data]
    sorted.sort((a, b) =>
      sortAscending
        ? a.total_seconds - b.total_seconds
        : b.total_seconds - a.total_seconds
    )
    return sorted
  }, [data, sortAscending])

  const labels = useMemo(
    () => sortedData.map((item) => item.program_name),
    [sortedData]
  )

  const values = useMemo(
    () => sortedData.map((item) => Math.round(item.total_seconds / 60)),
    [sortedData]
  )

  const themeColor = useThemeStore((s) => s.themeColor)
  const primaryRgb = useMemo(() => getPrimaryRgb(), [themeColor])

  const chartData = {
    labels,
    datasets: [
      {
        label: '使用时长 (分钟)',
        data: values,
        backgroundColor: `rgba(${primaryRgb}, 0.78)`,
        borderColor: `rgb(${primaryRgb})`,
        borderWidth: 1,
        borderRadius: 4,
        // Fixed thickness keeps bars readable; the chart height below grows
        // with the entry count so bars never get squeezed together.
        barThickness: 26
      }
    ]
  }

  const options = {
    indexAxis: 'y' as const,
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
          label: (context: any) => {
            const entry = sortedData[context.dataIndex]
            return formatDuration(entry?.total_seconds || 0)
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(148, 163, 184, 0.1)'
        },
        title: {
          display: true,
          text: '分钟',
          color: 'rgb(148, 163, 184)',
          font: { size: 11 },
          padding: { top: 4 }
        },
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: { size: 11 },
          callback: (value: number | string) => formatTick(value)
        }
      },
      y: {
        grid: {
          display: false
        },
        ticks: {
          color: 'rgb(148, 163, 184)',
          font: { size: 12 },
          autoSkip: false
        }
      }
    },
    onHover: (
      event: { native: Event | null },
      elements: { datasetIndex: number; index: number }[]
    ) => {
      const target = event.native?.target as HTMLElement | null
      if (target) {
        target.style.cursor = elements.length > 0 && onBarClick ? 'pointer' : 'default'
      }
    },
    onClick: (_: unknown, elements: { datasetIndex: number; index: number }[]) => {
      if (elements.length > 0 && onBarClick) {
        const index = elements[0].index
        const programId = sortedData[index]?.program_id
        if (programId) onBarClick(programId)
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

  // Give every category a fixed row height. With a fixed 256px container the
  // rows would compress into unreadable slivers once a user has many programs.
  const chartHeight = Math.max(220, sortedData.length * 42 + 16)

  // No inner scroll container: the page itself scrolls, so the wheel can't
  // get trapped inside a nested chart viewport.
  return (
    <div className="w-full" style={{ height: chartHeight }}>
      <Bar data={chartData} options={options} />
    </div>
  )
}

export default HorizontalBarChart
