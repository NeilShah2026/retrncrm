import * as React from 'react'
import {
  ArrowRight,
  Coffee,
  KanbanSquare,
  Sparkles,
  Users,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/utils'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called whenever the tour closes, whether skipped or completed. */
  onDismiss: () => void
  /** Called only when the user finishes via the final step's CTA. */
  onComplete: () => void
}

interface Step {
  icon: typeof Users
  eyebrow: string
  title: string
  body: string
  kind?: 'name'
}

const STEPS: Step[] = [
  {
    icon: Sparkles,
    eyebrow: 'Welcome to Retrn',
    title: 'What should we call you?',
    body: "We'll use it around the app instead of your email.",
    kind: 'name',
  },
  {
    icon: Sparkles,
    eyebrow: 'Welcome to Retrn',
    title: 'Every person you meet, one search away',
    body: "Career fairs, coffee chats, a bus ride, a flight — Retrn is where you keep track of everyone, so nobody you meet ever falls through the cracks.",
  },
  {
    icon: Users,
    eyebrow: 'Capture',
    title: 'Add anyone in seconds',
    body: 'A name and how you met is enough to save. Press "N" anywhere in the app to add someone, or paste a LinkedIn profile to auto-fill the details.',
  },
  {
    icon: Coffee,
    eyebrow: 'Stay in touch',
    title: "Retrn tells you who to reach out to, and when",
    body: 'Set a reconnect goal on anyone — monthly, quarterly, whatever fits — and your dashboard will surface exactly who\'s overdue, with a one-click prep brief before you reach out.',
  },
  {
    icon: KanbanSquare,
    eyebrow: 'Follow through',
    title: 'Track your pipeline, not just your contacts',
    body: 'Log every internship and job on a simple board, link the people who can help, and send outreach with ready-made templates — no blank page, ever.',
  },
]

export function WelcomeTour({
  open,
  onOpenChange,
  onDismiss,
  onComplete,
}: Props) {
  const { user, updateName } = useAuth()
  const [step, setStep] = React.useState(0)
  const [name, setName] = React.useState('')
  const last = step === STEPS.length - 1
  const current = STEPS[step]
  const isNameStep = current.kind === 'name'

  // Read the latest user via a ref rather than a dependency: `updateName`
  // below triggers a Supabase auth-state change, which gives us a new
  // `user` object while the dialog is still open. If `user` were a
  // dependency, that alone would re-run this effect and snap `step` back
  // to 0 right after advancing — "Continue" would look like it does nothing.
  const userRef = React.useRef(user)
  userRef.current = user

  React.useEffect(() => {
    if (open) {
      setStep(0)
      setName((userRef.current?.user_metadata?.full_name as string | undefined) ?? '')
    }
  }, [open])

  function next() {
    if (isNameStep && name.trim()) void updateName(name.trim())
    if (last) {
      onDismiss()
      onComplete()
      onOpenChange(false)
    } else {
      setStep((s) => s + 1)
    }
  }

  function skip() {
    if (isNameStep && name.trim()) void updateName(name.trim())
    onDismiss()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent hideClose className="sm:max-w-md">
        <DialogTitle className="sr-only">{current.title}</DialogTitle>
        <DialogDescription className="sr-only">{current.body}</DialogDescription>

        <div className="flex flex-col items-center px-2 pb-2 pt-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white shadow-lg">
            <current.icon className="h-7 w-7" />
          </div>

          <p className="mt-5 text-xs font-semibold uppercase tracking-wider text-indigo-600">
            {current.eyebrow}
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            {current.title}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            {current.body}
          </p>

          {isNameStep && (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') next()
              }}
              placeholder="Your first name"
              className="mt-4 w-full rounded-lg border bg-background px-3.5 py-2.5 text-center text-sm outline-none transition-colors focus:border-indigo-400"
            />
          )}

          <div className="mt-6 flex items-center gap-1.5">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  i === step ? 'w-5 bg-indigo-500' : 'w-1.5 bg-muted',
                )}
              />
            ))}
          </div>

          <div className="mt-7 flex w-full items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={skip}
              className="text-muted-foreground"
            >
              Skip
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next} className="gap-1.5">
                {isNameStep ? 'Continue' : last ? 'Add your first contact' : 'Next'}
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
