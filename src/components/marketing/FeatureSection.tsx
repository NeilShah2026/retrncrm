import { motion } from 'framer-motion'
import { CyclingBrowserFrame } from './CyclingBrowserFrame'
import { PhoneFrame } from './PhoneFrame'

interface Shot {
  src: string
  alt: string
}

type Accent = 'indigo' | 'violet' | 'rose'

const ACCENTS: Record<Accent, { text: string; glow: string }> = {
  indigo: { text: 'text-indigo-300', glow: 'bg-indigo-500/30' },
  violet: { text: 'text-violet-300', glow: 'bg-violet-500/30' },
  rose: { text: 'text-rose-300', glow: 'bg-rose-500/30' },
}

interface Props {
  eyebrow: string
  title: string
  description: string
  images: Shot[]
  reverse?: boolean
  accent?: Accent
  /** 'phone' shows only the first image, in an iPhone-style frame. */
  frame?: 'browser' | 'phone'
}

/**
 * Each feature lives in its own dark glass card rather than sitting directly
 * on the page's ambient gradient — the gradient shifts from cream to near-
 * black across the scroll, so text color that reads fine at one point looks
 * wrong a few hundred pixels later. A self-contained card keeps every
 * feature block equally readable no matter where it lands on the gradient.
 */
export function FeatureSection({
  eyebrow,
  title,
  description,
  images,
  reverse,
  accent = 'indigo',
  frame = 'browser',
}: Props) {
  const { text: accentText, glow } = ACCENTS[accent]

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0b17]/95 shadow-[0_40px_100px_-30px_rgba(0,0,0,0.55)] backdrop-blur-2xl"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-20 h-64 w-64 rounded-full blur-[100px] ${glow} ${
          reverse ? '-right-20' : '-left-20'
        }`}
      />

      <div className="relative grid grid-cols-1 items-center gap-10 p-8 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-14">
        <div className={reverse ? 'lg:order-2' : undefined}>
          <p className={`text-xs font-semibold uppercase tracking-wider ${accentText}`}>
            {eyebrow}
          </p>
          <h3 className="mt-3 font-serif text-3xl font-medium tracking-tight text-white sm:text-4xl">
            {title}
          </h3>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/60">
            {description}
          </p>
        </div>

        <motion.div
          whileHover={{ y: -4 }}
          transition={{ duration: 0.3 }}
          className={reverse ? 'lg:order-1' : undefined}
        >
          {frame === 'phone' ? (
            <PhoneFrame src={images[0].src} alt={images[0].alt} />
          ) : (
            <CyclingBrowserFrame images={images} />
          )}
        </motion.div>
      </div>
    </motion.div>
  )
}
