interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-5 h-5 border-2',
    lg: 'w-7 h-7 border-2',
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-line-strong border-t-accent animate-spin ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}
