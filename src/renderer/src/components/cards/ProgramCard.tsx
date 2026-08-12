import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import type { Program } from '@/types'
import { toFileUrl } from '@/utils/fileUrl'

interface ProgramCardProps {
  program: Program
  usageSeconds: number
  onEdit?: () => void
  onDelete?: () => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h} 小时 ${m} 分钟`
  return `${m} 分钟`
}

function getGradientColors(name: string): string {
  const gradients = [
    'from-blue-500/40 to-purple-600/40',
    'from-emerald-500/40 to-teal-600/40',
    'from-orange-500/40 to-red-600/40',
    'from-pink-500/40 to-rose-600/40',
    'from-cyan-500/40 to-blue-600/40',
    'from-violet-500/40 to-fuchsia-600/40'
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return gradients[Math.abs(hash) % gradients.length]
}

export const ProgramCard: React.FC<ProgramCardProps> = React.memo(
  ({ program, usageSeconds, onEdit, onDelete }) => {
    const navigate = useNavigate()
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

    const cardBg = program.card_image_path
      ? `url(${toFileUrl(program.card_image_path)})`
      : undefined

    return (
      <div
        onClick={() => navigate(`/programs/${program.id}`)}
        className="
          group relative overflow-hidden rounded-2xl cursor-pointer
          bg-slate-800/60 border border-white/10
          hover:border-primary/30 hover:shadow-lg hover:shadow-primary/10
          transition-all duration-300
          aspect-[4/3]
        "
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            navigate(`/programs/${program.id}`)
          }
        }}
      >
        {/* Background */}
        {cardBg ? (
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-300 group-hover:scale-105"
            style={{ backgroundImage: cardBg }}
          />
        ) : (
          <div
            className={`
              absolute inset-0 bg-gradient-to-br ${getGradientColors(program.name)}
            `}
          />
        )}

        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/30 to-transparent" />

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
        <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end justify-between">
          <div className="flex items-center gap-3">
            {program.icon_path && (
              <img
                src={toFileUrl(program.icon_path)!}
                alt={program.name}
                className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm"
                loading="lazy"
              />
            )}
            {!program.icon_path && (
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                <span className="text-lg font-bold text-white/80">
                  {program.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-sm font-medium text-white drop-shadow-sm">
              {program.name}
            </span>
          </div>

          {/* Usage time — shown on hover */}
          {usageSeconds > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-white/80 bg-black/40 backdrop-blur-sm px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(usageSeconds)}</span>
            </div>
          )}
        </div>
      </div>
    )
  }
)

ProgramCard.displayName = 'ProgramCard'

export default ProgramCard
