/** Grey placeholder block for loading states. */
export default function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`bg-raised rounded animate-pulse ${className}`} />
}

/** A few stacked placeholder rows — matches the shape of a list. */
export function SkeletonRows({ rows = 3, className = '' }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-12" />
      ))}
    </div>
  )
}
