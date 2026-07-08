import * as React from 'react'
import { Link } from 'react-router-dom'
import { Share2, Maximize2, ArrowRight, Building2, User } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { PageContainer } from '@/components/layout/PageContainer'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useContacts } from '@/hooks/useData'
import {
  computeIntroGraph,
  introChain,
  YOU_ID,
  type GraphNode,
} from '@/lib/graph'
import { fullName, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'

const NODE_HEX = [
  '#f43f5e', '#f97316', '#f59e0b', '#10b981', '#14b8a6',
  '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899',
]
function nodeColor(seed: string): string {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return NODE_HEX[h % NODE_HEX.length]
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

export function NetworkPage() {
  const contacts = useContacts()
  const [selected, setSelected] = React.useState<string | null>(null)

  const graph = React.useMemo(
    () => computeIntroGraph(contacts ?? []),
    [contacts],
  )

  const chain = React.useMemo(
    () => (selected ? introChain(selected, graph.byId) : []),
    [selected, graph],
  )
  const chainSet = React.useMemo(() => new Set(chain), [chain])

  // Companies reachable in the network, with fewest intro hops.
  const companies = React.useMemo(() => {
    const map = new Map<string, { count: number; minDepth: number; nearest: string }>()
    for (const n of graph.nodes) {
      if (!n.contact?.company) continue
      const co = n.contact.company
      const existing = map.get(co)
      if (!existing) {
        map.set(co, { count: 1, minDepth: n.depth, nearest: n.id })
      } else {
        existing.count++
        if (n.depth < existing.minDepth) {
          existing.minDepth = n.depth
          existing.nearest = n.id
        }
      }
    }
    return [...map.entries()]
      .map(([company, v]) => ({ company, ...v }))
      .sort((a, b) => a.minDepth - b.minDepth || a.company.localeCompare(b.company))
  }, [graph])

  const loading = contacts === undefined

  return (
    <PageContainer width="wide" flush>
      <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 pb-3 pt-5 backdrop-blur md:-mx-8 md:px-8 md:pt-8">
        <PageHeader
          title="Network"
          description="Who introduced whom — trace the warm-intro path to any company."
        />
      </div>

      <div className="pt-4">
        {loading ? (
          <Skeleton className="h-[70vh] w-full" />
        ) : (contacts?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Share2}
            title="No network yet"
            description="Add contacts and set “who introduced you” on each to build your warm-intro map."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
            <IntroGraphView
              graph={graph}
              selected={selected}
              chainSet={chainSet}
              onSelect={setSelected}
            />
            <SidePanel
              graph={graph}
              companies={companies}
              selected={selected}
              chain={chain}
              onSelect={setSelected}
            />
          </div>
        )}
      </div>
    </PageContainer>
  )
}

function IntroGraphView({
  graph,
  selected,
  chainSet,
  onSelect,
}: {
  graph: ReturnType<typeof computeIntroGraph>
  selected: string | null
  chainSet: Set<string>
  onSelect: (id: string | null) => void
}) {
  const wrapRef = React.useRef<HTMLDivElement>(null)
  const [size, setSize] = React.useState({ w: 0, h: 0 })
  const [view, setView] = React.useState({ k: 1, tx: 0, ty: 0 })
  const drag = React.useRef<{ x: number; y: number; tx: number; ty: number } | null>(
    null,
  )

  // Measure the container.
  React.useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth, h: el.clientHeight })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  const fit = React.useCallback(() => {
    const { w, h } = size
    if (!w || !h) return
    const { minX, minY, maxX, maxY } = graph.bounds
    const pad = 80
    const gw = maxX - minX || 1
    const gh = maxY - minY || 1
    const k = clamp(Math.min((w - pad) / gw, (h - pad) / gh), 0.3, 1.6)
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    setView({ k, tx: w / 2 - cx * k, ty: h / 2 - cy * k })
  }, [size, graph])

  // Auto-fit when the container size or the graph changes.
  React.useEffect(() => {
    fit()
  }, [fit])

  function onWheel(e: React.WheelEvent) {
    e.preventDefault()
    const rect = wrapRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const factor = e.deltaY < 0 ? 1.12 : 0.89
    setView((v) => {
      const k = clamp(v.k * factor, 0.3, 2.6)
      const ratio = k / v.k
      return { k, tx: px - (px - v.tx) * ratio, ty: py - (py - v.ty) * ratio }
    })
  }

  function onPointerDown(e: React.PointerEvent) {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return
    setView((v) => ({
      ...v,
      tx: drag.current!.tx + (e.clientX - drag.current!.x),
      ty: drag.current!.ty + (e.clientY - drag.current!.y),
    }))
  }
  function onPointerUp() {
    drag.current = null
  }

  const hasSelection = Boolean(selected)

  return (
    <div className="relative">
      <div
        ref={wrapRef}
        className="relative h-[58vh] w-full overflow-hidden rounded-xl border bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] [background-size:22px_22px] lg:h-[72vh]"
      >
        <svg
          className="h-full w-full touch-none"
          style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <rect
            width="100%"
            height="100%"
            fill="transparent"
            onClick={() => onSelect(null)}
          />
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
            {/* Edges */}
            {graph.edges.map((e) => {
              const a = graph.byId.get(e.from)!
              const b = graph.byId.get(e.to)!
              const active = chainSet.has(e.from) && chainSet.has(e.to)
              return (
                <line
                  key={`${e.from}-${e.to}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={active ? '#6366f1' : 'hsl(var(--border))'}
                  strokeWidth={active ? 2.5 : 1.5}
                  opacity={hasSelection && !active ? 0.25 : 1}
                />
              )
            })}
            {/* Nodes */}
            {graph.nodes.map((n) => (
              <GraphNodeMark
                key={n.id}
                node={n}
                selected={selected === n.id}
                inChain={chainSet.has(n.id)}
                dimmed={hasSelection && !chainSet.has(n.id)}
                onSelect={onSelect}
              />
            ))}
          </g>
        </svg>

        <div className="absolute right-2 top-2 flex gap-1">
          <Button
            variant="secondary"
            size="icon-sm"
            onClick={fit}
            aria-label="Reset view"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-muted-foreground">
          Drag to pan · scroll to zoom · click a node
        </div>
      </div>
    </div>
  )
}

function GraphNodeMark({
  node,
  selected,
  inChain,
  dimmed,
  onSelect,
}: {
  node: GraphNode
  selected: boolean
  inChain: boolean
  dimmed: boolean
  onSelect: (id: string) => void
}) {
  const isYou = node.id === YOU_ID
  const r = isYou ? 26 : 20
  const label = isYou ? 'You' : node.contact ? node.contact.firstName : '?'
  const fill = isYou
    ? '#4f46e5'
    : node.contact
      ? nodeColor(fullName(node.contact))
      : '#94a3b8'
  const text = isYou
    ? 'YOU'
    : node.contact
      ? initials(node.contact)
      : '?'

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: 'pointer', opacity: dimmed ? 0.3 : 1 }}
      onClick={(e) => {
        e.stopPropagation()
        if (!isYou) onSelect(node.id)
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {(selected || inChain) && (
        <circle r={r + 5} fill="none" stroke="#6366f1" strokeWidth={selected ? 3 : 2} />
      )}
      <circle r={r} fill={fill} stroke="hsl(var(--background))" strokeWidth={3} />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={isYou ? 11 : 12}
        fontWeight={700}
        fill="#fff"
      >
        {text}
      </text>
      <text
        y={r + 15}
        textAnchor="middle"
        fontSize={12}
        fontWeight={600}
        fill="hsl(var(--foreground))"
      >
        {label.length > 14 ? `${label.slice(0, 13)}…` : label}
      </text>
    </g>
  )
}

function SidePanel({
  graph,
  companies,
  selected,
  chain,
  onSelect,
}: {
  graph: ReturnType<typeof computeIntroGraph>
  companies: { company: string; count: number; minDepth: number; nearest: string }[]
  selected: string | null
  chain: string[]
  onSelect: (id: string) => void
}) {
  const selectedContact =
    selected && selected !== YOU_ID ? graph.byId.get(selected)?.contact : null

  return (
    <div className="space-y-4">
      {selectedContact ? (
        <Card>
          <CardContent className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-semibold">Intro path</h2>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-sm">
              {chain.map((id, i) => {
                const node = graph.byId.get(id)
                const name =
                  id === YOU_ID
                    ? 'You'
                    : node?.contact
                      ? fullName(node.contact)
                      : '?'
                return (
                  <React.Fragment key={id}>
                    {i > 0 && (
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {id === YOU_ID ? (
                      <span className="font-medium">You</span>
                    ) : (
                      <button
                        onClick={() => onSelect(id)}
                        className={cn(
                          'rounded px-1 font-medium hover:bg-accent',
                          id === selected && 'text-indigo-500',
                        )}
                      >
                        {name}
                      </button>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {selectedContact.company && (
                <p>{selectedContact.jobTitle
                  ? `${selectedContact.jobTitle} · `
                  : ''}{selectedContact.company}</p>
              )}
              <p>
                {chain.length - 1 === 1
                  ? 'A direct connection'
                  : `${chain.length - 1} hops away`}
              </p>
            </div>
            <Button asChild size="sm" className="mt-3 w-full gap-1">
              <Link to={ROUTES.contact(selectedContact.id)}>
                View profile <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Click a person to trace how you're connected, or pick a company below
            to find your warmest path in.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <h2 className="text-sm font-semibold">Warmest paths by company</h2>
          </div>
          <ul className="max-h-[46vh] space-y-1 overflow-y-auto scrollbar-thin">
            {companies.map((c) => {
              const near = graph.byId.get(c.nearest)?.contact
              return (
                <li key={c.company}>
                  <button
                    onClick={() => onSelect(c.nearest)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent',
                      c.nearest === selected && 'bg-accent',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {c.company}
                      </span>
                      {near && (
                        <span className="block truncate text-xs text-muted-foreground">
                          via {fullName(near)}
                          {c.count > 1 ? ` +${c.count - 1}` : ''}
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {c.minDepth === 1 ? 'direct' : `${c.minDepth} hops`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
