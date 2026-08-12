import React from 'react'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label?: string
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label
}) => {
  return (
    <label
      className={`
        inline-flex items-center gap-3
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="sr-only"
        />
        {/* Track */}
        <div
          className={`
            w-10 h-6 rounded-full transition-colors duration-200
            ${checked ? 'bg-primary' : 'bg-white/20'}
          `}
        />
        {/* Thumb */}
        <div
          className={`
            absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-md
            transition-transform duration-200
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </div>
      {label && <span className="text-sm text-text-primary">{label}</span>}
    </label>
  )
}

export default Switch
