import * as React from 'react'
import { motion, useReducedMotion } from 'framer-motion'

type Accent = 'indigo' | 'violet' | 'rose'

const ACCENTS: Record<Accent, { text: string; glow: string; line: string }> = {
  indigo: {
    text: 'text-indigo-300',
    glow: 'bg-indigo-500/20',
    line: 'from-indigo-400/60',
  },
  violet: {
    text: 'text-violet-300',
    glow: 'bg-violet-500/20',
    line: 'from-violet-400/60',
  },
  rose: {
    text: 'text-rose-300',
    glow: 'bg-rose-500/20',
    line: 'from-rose-400/60',
  },
}

interface Props {
  index: number
  eyebrow: string
  title: string
  description: string
  /** The live UI mockup to float alongside the copy. */
  visual: React.ReactNode
  reverse?: boolean
  accent?: Accent
}

/**
 * One feature: an editorial copy column beside a live product mockup that
 * floats at a gentle 3D tilt. There's no enclosing panel — the whole page is
 * dark, so each mockup sits directly on the ambient gradient with a soft
 * accent glow behind it, which reads as "the product, alive" rather than a
 * boxed screenshot. The tilt eases flat on hover so it feels responsive.
 */
export function FeatureSection({
  index,
  eyebrow,
  title,
  description,
  visual,
  reverse,
  accent = 'indigo',
}: Props) {
  const reduce = useReducedMotion()
  const a = ACCENTS[accent]
  const tiltSign = reverse ? -1 : 1

  return (
    <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
      {/* Copy */}
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-120px' }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className={reverse ? 'lg:order-2' : undefined}
      >
        <div className="flex items-center gap-3">
          <span className={`font-mono text-xs font-medium ${a.text}`}>
            {String(index).padStart(2, '0')}
          </span>
          <span
            className={`h-px w-8 bg-gradient-to-r ${a.line} to-transparent`}
          />
          <span className={`text-xs font-semibold uppercase tracking-wider ${a.text}`}>
            {eyebrow}
          </span>
        </div>
        <h3 className="mt-5 max-w-md font-serif text-3xl font-medium leading-tight tracking-tight text-white sm:text-4xl">
          {title}
        </h3>
        <p className="mt-5 max-w-md text-base leading-relaxed text-white/55">
          {description}
        </p>
      </motion.div>

      {/* Live mockup, floating with accent glow */}
      <div
        style={{ perspective: 1400 }}
        className={`relative flex justify-center ${reverse ? 'lg:order-1' : ''}`}
      >
        <div
          aria-hidden
          className={`pointer-events-none absolute left-1/2 top-1/2 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[90px] ${a.glow}`}
        />
        <motion.div
          initial={
            reduce
              ? { opacity: 0 }
              : { opacity: 0, y: 32, rotateX: 10, rotateY: tiltSign * -14, scale: 0.94 }
          }
          whileInView={
            reduce
              ? { opacity: 1 }
              : { opacity: 1, y: 0, rotateX: 6, rotateY: tiltSign * -9, scale: 1 }
          }
          whileHover={reduce ? undefined : { rotateX: 0, rotateY: 0, y: -8, scale: 1.02 }}
          viewport={{ once: true, margin: '-120px' }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="relative w-full"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {visual}
        </motion.div>
      </div>
    </div>
  )
}
