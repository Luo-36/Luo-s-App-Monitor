import React from 'react'

interface InputProps {
  label?: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
  error?: string
  icon?: React.ReactNode
  className?: string
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  error,
  icon,
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
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">
            {icon}
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`
            w-full px-4 py-2.5 rounded-xl text-sm text-white
            bg-white/5 border border-white/10
            placeholder:text-text-secondary/50
            focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50
            transition-all duration-200
            ${icon ? 'pl-10' : ''}
            ${error ? 'border-red-400/50 focus:ring-red-400/50 focus:border-red-400/50' : ''}
          `}
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}

export default Input
