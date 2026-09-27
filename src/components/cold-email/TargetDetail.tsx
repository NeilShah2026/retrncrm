import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Check,
  CircleSlash,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Reply,
  RotateCcw,
  Send,
  Trash2,
  UserPlus,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import {
  COLD_STAGES,
  coldStage,
  describeFollowUp,
  followUpOrdinal,
  nextFollowUpAfter,
  NO_REPLY_AFTER_DAYS,
  shortDate,
  sortedSends,
  targetName,
} from '@/lib/coldEmail'
import { ROUTES } from '@/lib/routes'
import { coldTargetRepo } from '@/services'
import type { Sender } from '@/lib/ai/coldEmail'
import { ColdEmailEditor } from './ColdEmailEditor'
import { LogSendDialog } from './LogSendDialog'
import { TargetFormDialog } from './TargetFormDialog'
import { convertToContact, markReplied } from './actions'
import type { ColdTarget } from '@/types'

/** Everything about one person you're writing to, and the one next step. */
export function TargetDetail({
  target,
  sender,
  onDeleted,
}: {
  target: ColdTarget
  sender: Sender
  onDeleted: () => void
}) {
  const navigate = useNavigate()
  const stage = coldStage(target)
  const [logOpen, setLogOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [converting, setConverting] = React.useState(false)
  const name = targetName(target)
  const first = target.firstName || name

  async function update(patch: Partial<ColdTarget>, failure = 'Couldn’t save that.') {
    try {
      await coldTargetRepo.update(target.id, patch)
    } catch (err) {
      console.error(err)
      toast.error(failure)
    }
  }

  async function convert() {
    setConverting(true)
    try {
      const contact = await convertToContact(target)
      if (!contact) return
      toast.success(`${first} is now a contact`, {
        description: 'Your emails came with them.',
        action: { label: 'Open', onClick: () => navigate(ROUTES.contact(contact.id)) },
      })
    } catch (err) {
      console.error(err)
      toast.error('Couldn’t make them a contact.')
    } finally {
      setConverting(false)
    }
  }

  function replied() {
    void markReplied(target, () => void convert()).catch(() => toast.error('Couldn’t save that.'))
  }

  const primary = (() => {
    switch (stage) {
      case 'drafting':
        return (
          <Button onClick={() => setLogOpen(true)}>
            <Send />
            Log as sent
          </Button>
        )
      case 'due':
      case 'waiting':
      case 'no-reply':
        return (
          <>
            <Button variant="outline" onClick={replied}>
              <Reply />
              They replied
            </Button>
            <Button variant={stage === 'due' ? 'default' : 'outline'} onClick={() => setLogOpen(true)}>
              <Send />
              Log follow-up
            </Button>
          </>
        )
      case 'replied':
        return (
          <Button onClick={() => void convert()} loading={converting}>
            <UserPlus />
            Make a contact
          </Button>
        )
      case 'converted':
        return target.contactId ? (
          <Button variant="outline" onClick={() => navigate(ROUTES.contact(target.contactId!))}>
            Open contact
          </Button>
        ) : null
      case 'closed':
        return (
          <Button variant="outline" onClick={() => void update({ status: target.sends.length ? 'sent' : 'drafting' })}>
            <RotateCcw />
            Reopen
          </Button>
        )
    }
  })()

  return (
    <div className="flex h-full flex-col">
      {/* Who, and the next step */}
      <div className="space-y-3 border-b px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-semibold tracking-[-0.01em]">{name}</h2>
              <Badge variant={COLD_STAGES[stage].tone}>{COLD_STAGES[stage].label}</Badge>
            </div>
            <p className="truncate text-sm text-text-secondary">
              {[target.role, target.company].filter(Boolean).join(' at ') || 'No role or company yet'}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {target.email ? (
                <button
                  className="rounded-sm hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(target.email!)
                      .then(() => toast.success('Address copied'))
                      .catch(() => toast.error('Couldn’t copy that.'))
                  }
                  title="Copy address"
                >
                  {target.email}
                </button>
              ) : (
                <button className="text-brand hover:underline" onClick={() => setEditOpen(true)}>
                  Add their email
                </button>
              )}
              {target.linkedinUrl && (
                <a
                  href={target.linkedinUrl.startsWith('http') ? target.linkedinUrl : `https://${target.linkedinUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  LinkedIn
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                <Pencil />
                Edit details
              </DropdownMenuItem>
              {target.sends.length > 0 && stage !== 'drafting' && (
                <DropdownMenuItem onSelect={() => setLogOpen(true)}>
                  <Send />
                  Log another email
                </DropdownMenuItem>
              )}
              {stage === 'replied' && (
                <DropdownMenuItem
                  onSelect={() =>
                    void update({
                      status: target.sends.length ? 'sent' : 'drafting',
                      repliedAt: undefined,
                    })
                  }
                >
                  <RotateCcw />
                  Not replied after all
                </DropdownMenuItem>
              )}
              {stage !== 'closed' && stage !== 'converted' && (
                <DropdownMenuItem
                  onSelect={() => void update({ status: 'closed', nextFollowUp: undefined })}
                >
                  <CircleSlash />
                  Close — stop following up
                </DropdownMenuItem>
              )}
              {stage !== 'converted' && stage !== 'replied' && (
                <DropdownMenuItem onSelect={() => void convert()}>
                  <UserPlus />
                  Make a contact now
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-danger focus:text-danger" onSelect={() => setDeleting(true)}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {primary && <div className="flex flex-wrap items-center gap-2">{primary}</div>}

        <FollowUpLine target={target} stage={stage} onChange={(date) => void update({ nextFollowUp: date })} />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-4">
        {stage !== 'converted' && (
          <>
            <SavedField
              key={`hook-${target.id}`}
              label="Why them?"
              hint="The specific reason you’re writing to this person. Drafts are built from it."
              placeholder="Same school, something they built or wrote, the move you’re weighing"
              value={target.hook ?? ''}
              rows={2}
              onSave={(hook) => update({ hook: hook || undefined })}
            />
            <ColdEmailEditor key={`${target.id}:${target.sends.length}`} target={target} sender={sender} />
          </>
        )}

        <History target={target} />

        <SavedField
          key={`notes-${target.id}`}
          label="Notes"
          placeholder="Anything worth remembering"
          value={target.notes ?? ''}
          rows={3}
          onSave={(notes) => update({ notes: notes || undefined })}
        />
      </div>

      <LogSendDialog open={logOpen} onOpenChange={setLogOpen} target={target} />
      <TargetFormDialog open={editOpen} onOpenChange={setEditOpen} target={target} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${name}?`}
        description={
          target.contactId
            ? 'Their contact stays. Only this cold email history goes.'
            : 'Their cold email history goes with them. This can’t be undone.'
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          try {
            await coldTargetRepo.remove(target.id)
            onDeleted()
          } catch (err) {
            console.error(err)
            toast.error('Couldn’t delete them.')
          }
        }}
      />
    </div>
  )
}

/** When the next nudge is, and a way to move or cancel it. */
function FollowUpLine({
  target,
  stage,
  onChange,
}: {
  target: ColdTarget
  stage: ReturnType<typeof coldStage>
  onChange: (date: string | undefined) => void
}) {
  if (stage === 'drafting') {
    return (
      <p className="text-xs text-muted-foreground">
        Once it’s sent, Retrn reminds you to follow up after 5 days, then a week after that.
      </p>
    )
  }
  if (stage === 'replied' || stage === 'converted' || stage === 'closed') return null

  if (!target.nextFollowUp) {
    return (
      <p className="text-xs text-muted-foreground">
        {stage === 'no-reply'
          ? 'Two follow-ups and no answer. Close it, or try someone else at the company.'
          : `Both follow-ups sent. If there’s nothing in ${NO_REPLY_AFTER_DAYS} days, it’s marked no reply.`}
      </p>
    )
  }

  const ordinal = followUpOrdinal(target)
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className={stage === 'due' ? 'font-medium text-warning' : 'text-muted-foreground'}>
        {ordinal ? `${ordinal}: ` : 'Follow up: '}
        {describeFollowUp(target.nextFollowUp)} · {shortDate(target.nextFollowUp)}
      </span>
      <Input
        type="date"
        aria-label="Change the follow-up date"
        className="tnum h-7 w-[9.5rem] text-xs"
        value={target.nextFollowUp}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />
      <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
        No more follow-ups
      </Button>
    </div>
  )
}

/** Every email, then how it ended. */
function History({ target }: { target: ColdTarget }) {
  const sends = sortedSends(target.sends)
  if (sends.length === 0 && !target.repliedAt) return null

  async function removeSend(id: string) {
    const rest = sends.filter((s) => s.id !== id)
    try {
      await coldTargetRepo.update(target.id, {
        sends: rest,
        status: rest.length === 0 && target.status === 'sent' ? 'drafting' : target.status,
        nextFollowUp: target.status === 'sent' ? nextFollowUpAfter(rest) : target.nextFollowUp,
      })
    } catch (err) {
      console.error(err)
      toast.error('Couldn’t remove that.')
    }
  }

  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold">History</h3>
      <ol className="rounded-lg border">
        {sends.map((s, i) => (
          <li key={s.id} className="group flex items-center gap-3 border-b px-3 py-2 last:border-b-0">
            <span className="tnum w-12 shrink-0 text-xs text-muted-foreground">{shortDate(s.date)}</span>
            <span className="min-w-0 flex-1 truncate text-sm">
              <span className="text-text-secondary">{i === 0 ? 'Cold email' : `Follow-up ${i}`}</span>
              {s.subject && <span className="text-muted-foreground"> · {s.subject}</span>}
            </span>
            {s.link && (
              <a
                href={s.link}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Open the thread"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
            <button
              className="text-xs text-muted-foreground opacity-0 hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
              onClick={() => void removeSend(s.id)}
            >
              Remove
            </button>
          </li>
        ))}
        {target.repliedAt && (
          <li className="flex items-center gap-3 px-3 py-2">
            <span className="tnum w-12 shrink-0 text-xs text-muted-foreground">
              {shortDate(target.repliedAt.slice(0, 10))}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-success">
              <Check className="h-3.5 w-3.5" />
              {target.status === 'converted' ? 'Replied — now a contact' : 'Replied'}
            </span>
          </li>
        )}
      </ol>
    </section>
  )
}

/** A text field that saves itself when you leave it. */
function SavedField({
  label,
  hint,
  placeholder,
  value,
  rows,
  onSave,
}: {
  label: string
  hint?: string
  placeholder?: string
  value: string
  rows: number
  onSave: (value: string) => Promise<void> | void
}) {
  const [text, setText] = React.useState(value)
  const id = React.useId()
  return (
    <section className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <Textarea
        id={id}
        rows={rows}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim() !== value.trim()) void onSave(text.trim())
        }}
      />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </section>
  )
}
