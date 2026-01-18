import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  onClick?: () => void
}

export default function Card({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
  onClick,
}: CardProps) {
  const variants = {
    default: 'bg-white border border-slate-100',
    elevated: 'bg-white shadow-card',
    outlined: 'bg-transparent border-2 border-slate-200',
  }

  const paddings = {
    none: 'p-0',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
  }

  return (
    <div
      className={`rounded-2xl ${variants[variant]} ${paddings[padding]} ${className} ${
        onClick ? 'cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]' : ''
      }`}
      onClick={onClick}
    >
      {children}
    </div>
  )
}
