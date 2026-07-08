import { Link } from 'react-router-dom'
import { ContactAvatar } from '@/components/common/ContactAvatar'
import { fullName } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ROUTES } from '@/lib/routes'
import type { Contact } from '@/types'

interface Props {
  contact: Contact
  /** Render as a link to the contact's profile. */
  asLink?: boolean
  className?: string
}

/** Compact avatar + name, used in opportunity cards, graph panels, etc. */
export function ContactChip({ contact, asLink, className }: Props) {
  const inner = (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2 text-xs',
        asLink && 'transition-colors hover:bg-accent',
        className,
      )}
    >
      <ContactAvatar contact={contact} className="h-5 w-5 text-[9px]" />
      <span className="max-w-[9rem] truncate">{fullName(contact)}</span>
    </span>
  )
  return asLink ? (
    <Link to={ROUTES.contact(contact.id)} onClick={(e) => e.stopPropagation()}>
      {inner}
    </Link>
  ) : (
    inner
  )
}
