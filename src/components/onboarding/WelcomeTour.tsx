import * as React from 'react'
import { ArrowRight, Coffee, KanbanSquare, Hand, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    icon: Hand,
    eyebrow: 'Welcome',
    title: 'What should we call you?',
    body: 'Used around the app instead of your email.',
    kind: 'name',
  },
  {
    icon: Users,
    eyebrow: 'Capture',
    title: 'Every person you meet, one search away',
    body: 'Career fairs, coffee chats, a bus ride, a flight. Type one line about who you met and Retrn turns it into a contact. Press N anywhere to add someone.',
  },
  {
    icon: Coffee,
    eyebrow: 'Stay in touch',
    title: 'Retrn tells you who to reach out to, and when',
    body: 'Set a reconnect goal on anyone — monthly, quarterly — and the dashboard surfaces exactly who’s overdue, with a prep brief before you reach out.',
  },
  {
    icon: KanbanSquare,
    eyebrow: 'Follow through',
    title: 'Track your pipeline, not just your contacts',
    body: 'Log every internship and job on a board, link the people who can help, and send outreach from templates that fill in from their record.',
  },
]

export function WelcomeTour({ open, onOpenChange, onDismiss, onComplete }: Props) {
  const { user, updateName } = useAuth()
  const [step, setStep] = React.useState(0)
  const [name, setName] = React.useState('')
  const last = step === STEPS.length - 1
  const current = STEPS[step]
  const isNameStep = current.kind === 'name'

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

        <div className="flex flex-col px-1 pb-1 pt-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-bg-sunken text-text-secondary">
            <current.icon className="h-4 w-4" />
          </span>

          <p className="text-label mt-5 text-muted-foreground">
            {current.eyebrow} · {step + 1} of {STEPS.length}
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-[-0.02em]">{current.title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{current.body}</p>

          {isNameStep && (
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') next()
              }}
              placeholder="Your first name"
              aria-label="Your first name"
              className="mt-4 h-9"
            />
          )}

          <div className="mt-6 flex items-center gap-1" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1 rounded-full transition-all duration-base',
                  i === step ? 'w-4 bg-foreground' : 'w-1.5 bg-border',
                )}
              />
            ))}
          </div>

          <div className="mt-5 flex w-full items-center justify-between gap-2">
            <Button variant="ghost" size="sm" onClick={skip} className="text-muted-foreground">
              Skip
            </Button>
            <div className="flex items-center gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button size="sm" onClick={next}>
                {isNameStep ? 'Continue' : last ? 'Add your first contact' : 'Next'}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
