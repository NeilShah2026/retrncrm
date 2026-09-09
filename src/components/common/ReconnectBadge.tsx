import { Badge } from '@/components/ui/badge'
import { getReconnectStatus } from '@/lib/reconnect'
import type { Contact } from '@/types'

/** "Overdue" / "Due soon", as a status tint. Nothing when on track. */
export function ReconnectBadge({ contact }: { contact: Contact }) {
  const status = getReconnectStatus(contact)
  if (status.overdue) {
    return <Badge variant="warning">{status.reason}</Badge>
  }
  if (
    status.overdueBy !== null &&
    status.goalDays !== null &&
    -status.overdueBy <= 14
  ) {
    return <Badge variant="outline">Due soon</Badge>
  }
  return null
}
