import { Badge } from '@/components/ui/badge'
import { getReconnectStatus } from '@/lib/reconnect'
import type { Contact } from '@/types'

/** Shows an "Overdue" / "Due soon" pill based on reconnect status. */
export function ReconnectBadge({ contact }: { contact: Contact }) {
  const status = getReconnectStatus(contact)
  if (status.overdue) {
    return <Badge variant="destructive">{status.reason}</Badge>
  }
  if (
    status.overdueBy !== null &&
    status.goalDays !== null &&
    -status.overdueBy <= 14
  ) {
    return <Badge variant="warning">Due soon</Badge>
  }
  return null
}
