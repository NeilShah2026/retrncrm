import { motion } from 'framer-motion'

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * A soft gradient hairline with a small glowing diamond at its center, used
 * to break up the tall dark sections. The lines expand outward and the
 * diamond scales in just after, matching the page's motion language.
 */
export function SectionDivider() {
  return (
    <div className="relative mx-auto flex max-w-xl items-center justify-center px-4 sm:px-6">
      <motion.div
        initial={{ opacity: 0, scaleX: 0.6 }}
        whileInView={{ opacity: 1, scaleX: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.9, ease: EASE }}
        className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
      <motion.span
        aria-hidden
        initial={{ opacity: 0, scale: 0.5 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6, delay: 0.25, ease: EASE }}
        className="mx-4 h-1.5 w-1.5 rotate-45 rounded-[1px] bg-white/25 shadow-[0_0_12px_rgba(255,255,255,0.35)]"
      />
      <motion.div
        initial={{ opacity: 0, scaleX: 0.6 }}
        whileInView={{ opacity: 1, scaleX: 1 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.9, ease: EASE }}
        className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent"
      />
    </div>
  )
}
