import { cn } from '@/lib/utils'

/**
 * A placeholder that matches the final layout. Never shown on its own for
 * more than LOADING_TIMEOUT_MS — wrap collections in `NetworkGate`.
 */
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-bg-sunken', className)}
      {...props}
    />
  )
}

/** A row of the contacts table / a list, while loading. */
function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-9 items-center gap-3 border-b px-3 last:border-b-0', className)}>
      <Skeleton className="h-5 w-5 rounded-full" />
      <Skeleton className="h-3 w-40" />
      <Skeleton className="ml-auto h-3 w-20" />
    </div>
  )
}

export { Skeleton, SkeletonRow }
