import { motion } from 'framer-motion'
import {
  Coffee,
  GraduationCap,
  Mail,
  MapPin,
  Plane,
  Users,
} from 'lucide-react'

interface OrbitIcon {
  Icon: typeof Coffee
  angle: number
  radius: number
  size: number
  delay: number
}

const ICONS: OrbitIcon[] = [
  { Icon: Coffee, angle: 20, radius: 130, size: 40, delay: 0 },
  { Icon: Mail, angle: 100, radius: 200, size: 44, delay: 0.4 },
  { Icon: GraduationCap, angle: 190, radius: 130, size: 36, delay: 0.8 },
  { Icon: Plane, angle: 250, radius: 260, size: 40, delay: 1.2 },
  { Icon: Users, angle: 320, radius: 200, size: 38, delay: 1.6 },
  { Icon: MapPin, angle: 60, radius: 260, size: 32, delay: 2 },
]

function pos(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: Math.cos(rad) * radius, y: Math.sin(rad) * radius }
}

interface Props {
  /** Set when the graphic sits on a light/warm background instead of dark. */
  light?: boolean
}

/**
 * A slowly rotating orbital system with floating "capture source" icons —
 * purely decorative, evokes "people you meet from everywhere" without
 * claiming literal app integrations.
 */
export function OrbitalGraphic({ light }: Props) {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[560px] w-[560px] max-w-full"
      style={{ perspective: 800 }}
    >
      {/* Concentric rings */}
      {[130, 200, 260].map((r) => (
        <span
          key={r}
          className={`absolute left-1/2 top-1/2 rounded-full border ${light ? 'border-black/10' : 'border-white/10'}`}
          style={{
            width: r * 2,
            height: r * 2,
            marginLeft: -r,
            marginTop: -r,
          }}
        />
      ))}

      {/* Glowing core */}
      <motion.div
        className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-amber-200 via-rose-300 to-fuchsia-400 blur-[2px]"
        animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div
        className={`absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl ${light ? 'bg-rose-400/40' : 'bg-rose-300/30'}`}
      />

      {/* Rotating ring of icons (outer rotates one way, is itself
          counter-rotated per-icon so the icon glyphs stay upright). Icon
          centers sit exactly on their ring radius at every animation frame —
          any "liveliness" comes from scale/glow, never from a position
          offset, so they never drift off the ring line. */}
      <motion.div
        className="absolute inset-0"
        animate={{ rotate: 360 }}
        transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
      >
        {ICONS.map(({ Icon, angle, radius, size, delay }, i) => {
          const { x, y } = pos(angle, radius)
          return (
            <motion.div
              key={i}
              className="absolute left-1/2 top-1/2"
              style={{ x, y, width: 0, height: 0 }}
              animate={{ rotate: -360 }}
              transition={{ duration: 70, repeat: Infinity, ease: 'linear' }}
            >
              <motion.div
                className={
                  light
                    ? 'flex items-center justify-center rounded-full border border-black/10 bg-white/80 text-zinc-700 shadow-[0_4px_20px_rgba(0,0,0,0.1)] backdrop-blur-sm'
                    : 'flex items-center justify-center rounded-full border border-white/15 bg-white/[0.08] text-white/90 shadow-[0_0_24px_rgba(255,255,255,0.1)] backdrop-blur-sm'
                }
                style={{
                  width: size,
                  height: size,
                  marginLeft: -size / 2,
                  marginTop: -size / 2,
                }}
                animate={{ scale: [1, 1.12, 1] }}
                transition={{
                  duration: 3.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay,
                }}
              >
                <Icon style={{ width: size * 0.45, height: size * 0.45 }} />
              </motion.div>
            </motion.div>
          )
        })}
      </motion.div>

      {/* Twinkling stars scattered around */}
      {Array.from({ length: 14 }).map((_, i) => {
        const angle = (i / 14) * 360 + i * 7
        const radius = 90 + ((i * 37) % 220)
        const { x, y } = pos(angle, radius)
        return (
          <span
            key={`star-${i}`}
            className={`absolute left-1/2 top-1/2 h-1 w-1 animate-twinkle rounded-full ${light ? 'bg-zinc-900/50' : 'bg-white'}`}
            style={{
              transform: `translate(${x}px, ${y}px)`,
              animationDelay: `${(i * 0.31) % 3}s`,
            }}
          />
        )
      })}
    </div>
  )
}
