import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Text field. States: default (hairline), hover (stronger hairline),
 * focus-visible (brand ring, no offset), disabled, invalid (danger ring via
 * aria-invalid).
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-8 w-full rounded-md border border-border bg-background px-2.5 py-1 text-sm text-foreground',
          'transition-colors duration-fast ease-out',
          'placeholder:text-muted-foreground/80',
          'hover:border-border-strong',
          'focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/25',
          'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
