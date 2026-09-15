import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge only knows Tailwind's own font sizes, so it read the type
 * utilities in index.css (`text-ios-body`, `text-label`…) as text *colours*
 * and dropped them whenever a real colour came later in the same `cn()` —
 * `cn('text-ios-body', 'text-muted-foreground')` lost its size entirely.
 * Registering them as sizes keeps both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [
        {
          text: [
            'ios-large-title',
            'ios-title',
            'ios-title3',
            'ios-headline',
            'ios-body',
            'ios-subhead',
            'ios-footnote',
            'ios-caption',
            'display',
            'label',
            'large-title',
          ],
        },
      ],
    },
  },
})

/** Merge Tailwind classes with conditional logic, de-duplicating conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Generate a reasonably-unique id without pulling in a uuid dependency. */
export function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
