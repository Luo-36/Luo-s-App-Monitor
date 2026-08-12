import React from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  className?: string
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
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
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            w-full px-4 py-2.5 rounded-xl text-sm text-white
            bg-white/5 border border-white/10
            appearance-none cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
            transition-all duration-200
          "
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-slate-800 text-white">
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary pointer-events-none" />
      </div>
    </div>
  )
}

export default Select
