import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { avatarColor, fullName, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Contact } from '@/types'

interface Props {
  contact: Pick<Contact, 'firstName' | 'lastName' | 'photo'>
  className?: string
}

export function ContactAvatar({ contact, className }: Props) {
  const seed = fullName(contact) || 'contact'
  return (
    <Avatar className={className}>
      {contact.photo && <AvatarImage src={contact.photo} alt={seed} />}
      <AvatarFallback className={cn(avatarColor(seed), 'text-[0.8em]')}>
        {initials(contact)}
      </AvatarFallback>
    </Avatar>
  )
}
