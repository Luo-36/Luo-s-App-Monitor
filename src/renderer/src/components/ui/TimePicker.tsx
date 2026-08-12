import React from 'react'
import { Clock } from 'lucide-react'

interface TimePickerProps {
  value: string
  onChange: (value: string) => void
  label?: string
  className?: string
}

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label,
  className = ''
}) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-text-secondary">
          {label}
        </label>
      )}
      <div className="relative">
        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
        <input
          type="time"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full pl-10 pr-4 py-2.5 rounded-xl text-sm text-white
            bg-white/5 border border-white/10
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
            transition-all duration-200
            [color-scheme:dark]
          "
        />
      </div>
    </div>
  )
}

export default TimePicker
