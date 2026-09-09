import {
  AtSign,
  Briefcase,
  Building2,
  Coffee,
  Dot,
  Globe,
  GraduationCap,
  Handshake,
  Landmark,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  Mic,
  Monitor,
  Phone,
  Plane,
  Presentation,
  Rocket,
  Ticket,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ConnectionType, InteractionType, MeetSource } from '@/types'

/**
 * Icons for enumerated fields, so lists and timelines never render emoji.
 * The emoji in `constants.ts` stay for the option pickers; product surfaces
 * use these.
 */
export const INTERACTION_ICONS: Record<InteractionType, LucideIcon> = {
  call: Phone,
  email: Mail,
  coffee: Coffee,
  text: MessageSquare,
  event: Ticket,
  meeting: Handshake,
  linkedin: Link2,
  other: Dot,
}

export const CONNECTION_ICONS: Record<ConnectionType, LucideIcon> = {
  recruiter: Briefcase,
  professor: GraduationCap,
  alumni: Landmark,
  classmate: Users,
  founder: Rocket,
  mentor: TrendingUp,
  investor: Building2,
  peer: Users,
  other: Dot,
}

export const SOURCE_ICONS: Record<MeetSource, LucideIcon> = {
  'career-fair': Ticket,
  class: GraduationCap,
  club: Users,
  'networking-event': Handshake,
  'guest-lecture': Presentation,
  hackathon: Monitor,
  'info-session': Presentation,
  'coffee-chat': Coffee,
  referral: Link2,
  online: Globe,
  travel: Plane,
  other: MapPin,
}

export { AtSign, Mic }
