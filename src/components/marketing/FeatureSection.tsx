import { motion } from 'framer-motion'
import { CyclingBrowserFrame } from './CyclingBrowserFrame'
import { PhoneFrame } from './PhoneFrame'

interface Shot {
  src: string
  alt: string
}

type Accent = 'indigo' | 'violet' | 'rose'

const ACCENTS: Record<Accent, { text: string; glow: string; numeral: string }> = {
  indigo: { text: 'text-indigo-300', glow: 'bg-indigo-500/25', numeral: 'text-indigo-200/10' },
  violet: { text: 'text-violet-300', glow: 'bg-violet-500/25', numeral: 'text-violet-200/10' },
  rose: { text: 'text-rose-300', glow: 'bg-rose-500/25', numeral: 'text-rose-200/10' },
}

interface Props {
  index: number
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
 * Each feature lives in its own dark glass panel rather than sitting
 * directly on the page's ambient gradient — the gradient shifts from cream
 * to near-black across the scroll, so text color that reads fine at one
 * point looks wrong a few hundred pixels later. A self-contained panel
 * keeps every feature equally readable no matter where it lands.
 *
 * The screenshot rests at a gentle 3D tilt (perspective + rotateX/Y) that
 * eases flatter on scroll-in and straightens further on hover — a nod to
 * Retrn's own "always slightly in motion" feel rather than a static image.
 */
export function FeatureSection({
  index,
  eyebrow,
  title,
  description,
  images,
  reverse,
  accent = 'indigo',
  frame = 'browser',
}: Props) {
  const { text: accentText, glow, numeral } = ACCENTS[accent]
  const tiltSign = reverse ? -1 : 1

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-gradient-to-b from-[#100d1c] to-[#0a0812] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.32)]"
    >
      <div
        aria-hidden
        className={`pointer-events-none absolute -top-24 h-72 w-72 rounded-full blur-[110px] ${glow} ${
          reverse ? '-right-24' : '-left-24'
        }`}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative grid grid-cols-1 items-center gap-6 p-8 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-16">
        <div className={`relative ${reverse ? 'lg:order-2' : ''}`}>
          <span
            aria-hidden
            className={`pointer-events-none absolute -left-1 -top-14 select-none font-serif text-[7rem] font-medium leading-none ${numeral} sm:text-[8rem]`}
          >
            {String(index).padStart(2, '0')}
          </span>
          <div className="relative">
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
        </div>

        <div
          style={{ perspective: 1100 }}
          className={reverse ? 'lg:order-1' : undefined}
        >
          <motion.div
            initial={{ rotateX: 16, rotateY: tiltSign * -26, opacity: 0, scale: 0.88 }}
            whileInView={{ rotateX: 9, rotateY: tiltSign * -16, opacity: 1, scale: 1 }}
            whileHover={{ rotateX: 2, rotateY: tiltSign * -4, y: -10, scale: 1.02 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.9, ease: 'easeOut' }}
          >
            {frame === 'phone' ? (
              <PhoneFrame src={images[0].src} alt={images[0].alt} className="mx-auto" />
            ) : (
              <CyclingBrowserFrame images={images} />
            )}
          </motion.div>
        </div>
      </div>
    </motion.div>
  )
}
