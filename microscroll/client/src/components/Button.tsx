import { ReactNode, ButtonHTMLAttributes } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  iconPosition?: 'left' | 'right'
  loading?: boolean
  children: ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-bold rounded-xl transition-all btn-press focus-ring disabled:opacity-50 disabled:cursor-not-allowed'
  
  const variants = {
    primary: 'bg-primary hover:bg-primary-dark text-white shadow-glow',
    secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
    ghost: 'bg-transparent hover:bg-slate-100 text-slate-700',
    outline: 'bg-transparent border-2 border-slate-200 hover:border-primary text-slate-700 hover:text-primary',
  }

  const sizes = {
    sm: 'h-10 px-4 text-sm gap-1.5',
    md: 'h-12 px-6 text-base gap-2',
    lg: 'h-14 px-8 text-lg gap-2.5',
  }

  const iconSizes = {
    sm: 'text-[18px]',
    md: 'text-[20px]',
    lg: 'text-[24px]',
  }

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="material-symbols-outlined animate-spin-slow text-[20px]">
          progress_activity
        </span>
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <span className={`material-symbols-outlined ${iconSizes[size]}`}>
              {icon}
            </span>
          )}
          {children}
          {icon && iconPosition === 'right' && (
            <span className={`material-symbols-outlined ${iconSizes[size]}`}>
              {icon}
            </span>
          )}
        </>
      )}
    </button>
  )
}
