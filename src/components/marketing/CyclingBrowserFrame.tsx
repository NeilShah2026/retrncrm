import * as React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Shot {
  src: string
  alt: string
}

interface Props {
  images: Shot[]
  /** ms between frames */
  interval?: number
  /** width/height of the captured screenshots, for a stable aspect ratio. */
  ratio?: string
  className?: string
}

/**
 * A browser-frame mockup that slowly crossfades between a few real
 * screenshots on a loop — a lightweight way to hint at the product actually
 * working without recording video.
 */
export function CyclingBrowserFrame({
  images,
  interval = 4200,
  ratio = '1400 / 900',
  className,
}: Props) {
  const [index, setIndex] = React.useState(0)
  const [paused, setPaused] = React.useState(false)

  React.useEffect(() => {
    if (images.length <= 1 || paused) return
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % images.length)
    }, interval)
    return () => clearInterval(id)
  }, [images.length, interval, paused])

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className={cn(
        'overflow-hidden rounded-xl border border-white/10 bg-[#0b0b12] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/[0.03] px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        {images.length > 1 && (
          <div className="ml-auto flex gap-1">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`Show frame ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  'h-1 w-3 rounded-full transition-colors',
                  i === index ? 'bg-white/70' : 'bg-white/15 hover:bg-white/30',
                )}
              />
            ))}
          </div>
        )}
      </div>
      <div className="relative w-full" style={{ aspectRatio: ratio }}>
        <AnimatePresence initial={false}>
          <motion.img
            key={images[index].src}
            src={images[index].src}
            alt={images[index].alt}
            className="absolute inset-0 h-full w-full object-cover object-top"
            initial={{ opacity: 0, scale: 1.015 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, ease: 'easeInOut' }}
            loading="lazy"
          />
        </AnimatePresence>
      </div>
    </div>
  )
}
