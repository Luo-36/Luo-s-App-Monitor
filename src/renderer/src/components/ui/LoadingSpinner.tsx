import React from 'react'
import { Loader2 } from 'lucide-react'

type SpinnerSize = 'sm' | 'md' | 'lg'

interface LoadingSpinnerProps {
  size?: SpinnerSize
  className?: string
}

const sizeClasses: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-8 h-8',
  lg: 'w-12 h-12'
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  className = ''
}) => {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2
        className={`
          ${sizeClasses[size]}
          animate-spin text-primary
        `}
      />
    </div>
  )
}

export default LoadingSpinner
