import type { Contact } from '@/types'

export const YOU_ID = '__you__'
const RING = 150

export interface GraphNode {
  id: string
  contact: Contact | null // null → the "You" root
  parentId: string | null
  depth: number
  x: number
  y: number
}

export interface GraphEdge {
  from: string
  to: string
}

export interface IntroGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  byId: Map<string, GraphNode>
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
}

/**
 * Resolve who introduced a contact, guarding against dangling references,
 * self-links, and cycles (fall back to a direct "You" connection).
 */
function resolveParent(
  c: Contact,
  byId: Map<string, Contact>,
): string | null {
  const pid = c.introducedById
  if (!pid || pid === c.id || !byId.has(pid)) return null
  // Walk ancestors; if we loop back to c, it's a cycle → treat as a root.
  const seen = new Set<string>([c.id])
  let cur: string | undefined = pid
  let steps = 0
  while (cur && steps++ < 500) {
    if (seen.has(cur)) return null
    seen.add(cur)
    cur = byId.get(cur)?.introducedById
    if (cur && !byId.has(cur)) cur = undefined
  }
  return pid
}

/**
 * Lay out the warm-intro forest as a radial tree rooted at "You". Each contact
 * is placed on a ring by how many introductions deep it is; sibling subtrees
 * get angular space proportional to their leaf counts so the tree doesn't
 * overlap. Coordinates are centered on (0,0).
 */
export function computeIntroGraph(contacts: Contact[]): IntroGraph {
  const byContactId = new Map(contacts.map((c) => [c.id, c]))
  const children = new Map<string, string[]>()
  children.set(YOU_ID, [])

  for (const c of contacts) {
    const parent = resolveParent(c, byContactId) ?? YOU_ID
    if (!children.has(parent)) children.set(parent, [])
    children.get(parent)!.push(c.id)
    if (!children.has(c.id)) children.set(c.id, [])
  }

  // Stable ordering of children for deterministic layout.
  for (const list of children.values()) {
    list.sort((a, b) => {
      const ca = byContactId.get(a)
      const cb = byContactId.get(b)
      const na = ca ? `${ca.firstName} ${ca.lastName}` : ''
      const nb = cb ? `${cb.firstName} ${cb.lastName}` : ''
      return na.localeCompare(nb)
    })
  }

  // Leaf counts (post-order) drive angular spans.
  const leaves = new Map<string, number>()
  function countLeaves(id: string): number {
    const kids = children.get(id) ?? []
    if (kids.length === 0) {
      leaves.set(id, 1)
      return 1
    }
    const total = kids.reduce((s, k) => s + countLeaves(k), 0)
    leaves.set(id, total)
    return total
  }
  countLeaves(YOU_ID)

  const nodes: GraphNode[] = []
  const parentOf = new Map<string, string | null>()

  function assign(
    id: string,
    depth: number,
    a0: number,
    a1: number,
    parentId: string | null,
  ) {
    const angle = (a0 + a1) / 2
    const r = depth * RING
    const x = depth === 0 ? 0 : r * Math.cos(angle)
    const y = depth === 0 ? 0 : r * Math.sin(angle)
    parentOf.set(id, parentId)
    nodes.push({
      id,
      contact: id === YOU_ID ? null : (byContactId.get(id) ?? null),
      parentId,
      depth,
      x,
      y,
    })
    const kids = children.get(id) ?? []
    const totalLeaves = kids.reduce((s, k) => s + (leaves.get(k) ?? 1), 0) || 1
    let a = a0
    for (const k of kids) {
      const frac = (leaves.get(k) ?? 1) / totalLeaves
      const span = (a1 - a0) * frac
      // Pad multi-child spans slightly so leaves fan out nicely.
      assign(k, depth + 1, a, a + span, id)
      a += span
    }
  }
  assign(YOU_ID, 0, -Math.PI / 2, (3 * Math.PI) / 2, null)

  const edges: GraphEdge[] = nodes
    .filter((n) => n.parentId)
    .map((n) => ({ from: n.parentId as string, to: n.id }))

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const xs = nodes.map((n) => n.x)
  const ys = nodes.map((n) => n.y)
  const bounds = {
    minX: Math.min(...xs, 0),
    minY: Math.min(...ys, 0),
    maxX: Math.max(...xs, 0),
    maxY: Math.max(...ys, 0),
  }

  return { nodes, edges, byId, bounds }
}

/** The chain of ids from a contact up to "You" (inclusive of both ends). */
export function introChain(
  contactId: string,
  byId: Map<string, GraphNode>,
): string[] {
  const chain: string[] = []
  let cur: string | null | undefined = contactId
  const seen = new Set<string>()
  while (cur && !seen.has(cur)) {
    chain.push(cur)
    seen.add(cur)
    cur = byId.get(cur)?.parentId
  }
  return chain.reverse() // You → … → contact
}
