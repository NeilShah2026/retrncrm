import type { JSX } from 'preact'

/**
 * The handful of Lucide icons the extension uses, copied as SVG so they match
 * the web app's exactly without bundling the whole set.
 */
type IconProps = { size?: number; class?: string; strokeWidth?: number }

function icon(children: JSX.Element) {
  return ({ size = 16, class: className, strokeWidth = 2 }: IconProps) => (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const X = icon(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
)
export const Check = icon(<path d="M20 6 9 17l-5-5" />)
export const Search = icon(
  <>
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </>,
)
export const ArrowUpRight = icon(
  <>
    <path d="M7 7h10v10" />
    <path d="M7 17 17 7" />
  </>,
)
export const ChevronDown = icon(<path d="m6 9 6 6 6-6" />)
export const Mail = icon(
  <>
    <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
    <rect x="2" y="4" width="20" height="16" rx="2" />
  </>,
)
export const LogOut = icon(
  <>
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
  </>,
)
export const Undo = icon(
  <>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
  </>,
)
export const UserPlus = icon(
  <>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" x2="19" y1="8" y2="14" />
    <line x1="22" x2="16" y1="11" y2="11" />
  </>,
)
export const Alert = icon(
  <>
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </>,
)
export const CircleCheck = icon(
  <>
    <circle cx="12" cy="12" r="10" />
    <path d="m9 12 2 2 4-4" />
  </>,
)
export const Copy = icon(
  <>
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </>,
)
export const ExternalLink = icon(
  <>
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
  </>,
)
