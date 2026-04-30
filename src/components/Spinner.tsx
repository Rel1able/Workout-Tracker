interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'w-4 h-4 border-2',
    md: 'w-6 h-6 border-2',
    lg: 'w-10 h-10 border-4',
  }

  return (
    <div
      className={`${sizeClasses[size]} rounded-full border-gray-600 border-t-emerald-500 animate-spin ${className}`}
    />
  )
}
