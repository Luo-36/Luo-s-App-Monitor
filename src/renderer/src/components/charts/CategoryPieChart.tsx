import React from 'react'
import { Pie } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

interface CategoryPieChartProps {
  labels: string[]
  /** Seconds per category. */
  values: number[]
  colors: string[]
  selectedIndex?: number | null
  onSelect?: (index: number) => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

export const CategoryPieChart: React.FC<CategoryPieChartProps> = ({
  labels,
  values,
  colors,
  selectedIndex = null,
  onSelect
}) => {
  // Emphasise the selected slice a little by offsetting it.
  const offset = labels.map((_, i) => (i === selectedIndex ? 10 : 0))

  const chartData = {
    labels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: 'rgba(15, 23, 42, 0.9)',
        borderWidth: 2,
        hoverOffset: 8,
        offset
      }
    ]
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleColor: 'rgb(248, 250, 252)',
        bodyColor: 'rgb(148, 163, 184)',
        borderColor: 'rgba(148, 163, 184, 0.2)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context: any) => {
            const seconds = Number(context.raw) || 0
            return `${formatDuration(seconds)}`
          }
        }
      }
    },
    onClick: (_: unknown, elements: any[]) => {
      if (elements.length > 0 && onSelect) {
        onSelect(elements[0].index)
      }
    }
  }

  if (labels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[220px] text-text-secondary text-sm">
        暂无分类数据
      </div>
    )
  }

  return (
    <div className="w-full h-full min-h-[220px]">
      <Pie data={chartData} options={options} />
    </div>
  )
}

export default CategoryPieChart
