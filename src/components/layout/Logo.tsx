import { cn } from '@/lib/utils'

/**
 * The wordmark. A neutral mark — the brand is the type, not a tile.
 *
 * Lives on its own (re-exported from AppLayout) so pages rendered outside the
 * app shell — the prerendered legal pages in particular — can use it without
 * pulling in auth, context, and the rest of the app layout.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <span className="text-[13px] font-semibold leading-none">R</span>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">Retrn</span>
    </div>
  )
}
