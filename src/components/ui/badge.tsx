import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Small label. Status variants are muted tints, never neon. `brand` is
 * reserved for the "Suggested" / "From note" marker on model output — it is
 * how the app says "a model wrote this" without a sparkle icon.
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-px text-xs font-medium leading-4',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-foreground',
        secondary: 'border-transparent bg-secondary text-text-secondary',
        outline: 'border-border text-text-secondary',
        brand: 'border-transparent bg-brand/10 text-brand',
        success: 'border-transparent bg-success-soft text-success',
        warning: 'border-transparent bg-warning-soft text-warning',
        destructive: 'border-transparent bg-danger-soft text-danger',
        info: 'border-transparent bg-info-soft text-info',
      },
    },
    defaultVariants: {
      variant: 'secondary',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

/** The one way model output is marked. Text, not iconography. */
function SuggestedBadge({
  children = 'Suggested',
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <Badge variant="brand" className={className} title="Written by the model from your data" {...props}>
      {children}
    </Badge>
  )
}

export { Badge, SuggestedBadge, badgeVariants }
