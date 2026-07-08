import { motion } from 'framer-motion'

interface Node {
  x: number
  y: number
  r: number
  label?: string
}

// A hub-and-spoke map, not a scattered star field: "You" in the middle,
// first-degree connections branching out, and a couple of second-degree
// connections one hop further — a clear, legible shape rather than an
// abstract cloud of dots.
const YOU: Node = { x: 50, y: 36, r: 5.2 }

const FIRST_DEGREE: Node[] = [
  { x: 17, y: 20, r: 3, label: 'Career fair' },
  { x: 13, y: 47, r: 2.8 },
  { x: 33, y: 60, r: 2.6, label: 'Coffee chat' },
  { x: 67, y: 60, r: 2.8 },
  { x: 85, y: 44, r: 3, label: 'Warm intro' },
  { x: 80, y: 15, r: 2.6 },
  { x: 47, y: 8, r: 2.4 },
]

const SECOND_DEGREE: Array<Node & { from: number }> = [
  { x: 4, y: 8, r: 2, from: 0 },
  { x: 96, y: 56, r: 2, from: 4 },
  { x: 27, y: 3, r: 1.8, from: 6 },
]

/**
 * Push a label outward along the You→node ray (so it never crosses back over
 * a hub line) and pick a text-anchor based on which side of center it lands
 * on, so long labels grow away from the map instead of off the edge.
 */
function labelLayout(n: Node, push = 5.5) {
  const dx = n.x - YOU.x
  const dy = n.y - YOU.y
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const r = n.r * 0.34
  const x = n.x + ux * (r + push)
  const y = n.y + uy * (r + push)
  const anchor: 'start' | 'middle' | 'end' =
    ux < -0.25 ? 'end' : ux > 0.25 ? 'start' : 'middle'
  return { x, y, anchor }
}

interface Props {
  className?: string
}

export function RelationshipMap({ className }: Props) {
  return (
    <div className={`relative mx-auto w-full max-w-3xl ${className ?? ''}`}>
      <svg
        viewBox="-9 -7 118 82"
        className="h-full w-full overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <radialGradient id="you-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffe3c2" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#ffe3c2" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="map-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f4c9a0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#c98fd6" stopOpacity="0.35" />
          </linearGradient>
          <filter id="map-node-glow" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur stdDeviation="1.1" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Hub → first-degree edges */}
        {FIRST_DEGREE.map((n, i) => (
          <motion.line
            key={`hub-${i}`}
            x1={YOU.x}
            y1={YOU.y}
            x2={n.x}
            y2={n.y}
            stroke="url(#map-edge)"
            strokeWidth={0.3}
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 0.65 }}
            viewport={{ once: true }}
            transition={{ duration: 1, delay: i * 0.1, ease: 'easeOut' }}
          />
        ))}

        {/* First-degree → second-degree edges */}
        {SECOND_DEGREE.map((n, i) => {
          const parent = FIRST_DEGREE[n.from]
          return (
            <motion.line
              key={`branch-${i}`}
              x1={parent.x}
              y1={parent.y}
              x2={n.x}
              y2={n.y}
              stroke="url(#map-edge)"
              strokeWidth={0.22}
              initial={{ pathLength: 0, opacity: 0 }}
              whileInView={{ pathLength: 1, opacity: 0.45 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: 0.7 + i * 0.15, ease: 'easeOut' }}
            />
          )
        })}

        {/* You */}
        <circle cx={YOU.x} cy={YOU.y} r={13} fill="url(#you-glow)" />
        <motion.circle
          cx={YOU.x}
          cy={YOU.y}
          r={YOU.r * 0.32}
          fill="#fff8ef"
          filter="url(#map-node-glow)"
          animate={{ opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
        <text
          x={YOU.x}
          y={YOU.y + 8.5}
          textAnchor="middle"
          fontSize="3.1"
          fontWeight={600}
          letterSpacing="0.06em"
          fill="currentColor"
          className="fill-white/80"
        >
          YOU
        </text>

        {/* First-degree nodes */}
        {FIRST_DEGREE.map((n, i) => (
          <g key={`n1-${i}`}>
            <motion.circle
              cx={n.x}
              cy={n.y}
              r={n.r * 0.34}
              fill="#fff7ec"
              filter="url(#map-node-glow)"
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
              style={{ transformOrigin: `${n.x}px ${n.y}px` }}
            />
            <motion.circle
              cx={n.x}
              cy={n.y}
              fill="none"
              stroke="#fff7ec"
              strokeWidth={0.15}
              initial={{ r: n.r * 0.34, opacity: 0.5 }}
              animate={{ r: [n.r * 0.34, n.r * 0.7, n.r * 0.34], opacity: [0.5, 0, 0.5] }}
              transition={{
                duration: 3.4,
                repeat: Infinity,
                ease: 'easeOut',
                delay: i * 0.4,
              }}
            />
            {n.label &&
              (() => {
                const { x, y, anchor } = labelLayout(n)
                // Rough monospace-ish width estimate to size the backing chip.
                const textW = n.label.length * 1.5 + 3
                const chipX =
                  anchor === 'start'
                    ? x - 1.5
                    : anchor === 'end'
                      ? x - textW + 1.5
                      : x - textW / 2
                return (
                  <motion.g
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, delay: 0.8 + i * 0.1 }}
                  >
                    <rect
                      x={chipX}
                      y={y - 2.1}
                      width={textW}
                      height={4.2}
                      rx={2.1}
                      fill="#050308"
                      fillOpacity={0.35}
                    />
                    <text
                      x={x}
                      y={y + 0.9}
                      textAnchor={anchor}
                      fontSize="2.6"
                      letterSpacing="0.02em"
                      className="fill-white/75"
                    >
                      {n.label}
                    </text>
                  </motion.g>
                )
              })()}
          </g>
        ))}

        {/* Second-degree nodes */}
        {SECOND_DEGREE.map((n, i) => (
          <motion.circle
            key={`n2-${i}`}
            cx={n.x}
            cy={n.y}
            r={n.r * 0.32}
            fill="#fff7ec"
            filter="url(#map-node-glow)"
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 0.85, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 1 + i * 0.15 }}
            style={{ transformOrigin: `${n.x}px ${n.y}px` }}
          />
        ))}
      </svg>

      {/* Shooting star */}
      <motion.div
        aria-hidden
        className="absolute h-px w-20 rounded-full bg-gradient-to-r from-transparent via-white to-transparent"
        style={{ top: '10%', left: '-8%' }}
        animate={{
          left: ['-8%', '115%'],
          top: ['10%', '38%'],
          opacity: [0, 1, 1, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatDelay: 6,
          ease: 'easeIn',
        }}
      />
    </div>
  )
}
