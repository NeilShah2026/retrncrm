import * as React from 'react'

interface Props {
  index: number
  eyebrow: string
  title: string
  description: string
  /** The live UI mockup. */
  visual: React.ReactNode
  /** The lead feature: copy beside a wide mockup. Others stack copy over mockup. */
  lead?: boolean
}

/**
 * One feature. The lead runs full width with the mockup beside the copy;
 * supporting features stack in a two-column grid. No tilt, no glow, no
 * scroll-triggered motion — the mockup sits still on a hairline.
 */
export function FeatureSection({ index, eyebrow, title, description, visual, lead }: Props) {
  const copy = (
    <div className={lead ? 'max-w-md' : 'max-w-sm'}>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="tnum font-medium">{String(index).padStart(2, '0')}</span>
        <span className="h-px w-6 bg-border" aria-hidden />
        <span className="text-label">{eyebrow}</span>
      </p>
      <h3
        className={
          lead
            ? 'text-display mt-4 text-3xl sm:text-4xl'
            : 'mt-4 text-xl font-semibold tracking-[-0.02em] sm:text-2xl'
        }
      >
        {title}
      </h3>
      <p className="mt-3 text-base leading-relaxed text-text-secondary">{description}</p>
    </div>
  )

  if (lead) {
    return (
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        {copy}
        <div>
          {visual}
          <p className="mt-2 text-right text-xs text-muted-foreground">Example data</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      {copy}
      <div>
        {visual}
        <p className="mt-2 text-right text-xs text-muted-foreground">Example data</p>
      </div>
    </div>
  )
}
