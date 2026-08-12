import React from 'react'

interface CardProps {
  className?: string
  children: React.ReactNode
  onClick?: () => void
  hoverable?: boolean
}

export const Card: React.FC<CardProps> = ({
  className = '',
  children,
  onClick,
  hoverable = false
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        glass rounded-2xl
        ${hoverable ? 'cursor-pointer glass-hover' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  )
}

export default Card
