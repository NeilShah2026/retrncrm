import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { impactFeedback, tapFeedback } from '@/lib/haptics'
import { dismissKeyboard } from '@/lib/keyboard'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      // Phone: `.sheet-overlay` fades on the sheet's own clock (index.css).
      'sheet-overlay fixed inset-0 z-50 bg-black/40 dark:bg-black/60',
      'sm:duration-fast sm:data-[state=open]:animate-in sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** Past this far, letting go of a dragged sheet dismisses it… */
const DISMISS_AT = 120
/** …as does flicking it down at this speed (px/ms), from a shorter pull. */
const DISMISS_VELOCITY = 0.9
/** How the sheet settles back when a drag doesn't dismiss it. */
const SETTLE = 'transform 360ms var(--sheet-ease)'

/**
 * Swipe-down-to-dismiss for the phone's bottom sheet, from the grabber or the
 * bar under it. The sheet follows the finger one-to-one, the backdrop lightens
 * as it goes, a flick dismisses as readily as a long pull, and a sheet that
 * is let go of leaves from wherever it was rather than snapping back first.
 */
function useSheetDrag() {
  const sheetRef = React.useRef<HTMLDivElement | null>(null)
  const closeRef = React.useRef<HTMLButtonElement | null>(null)
  const drag = React.useRef<{ startY: number; offset: number; lastY: number; lastT: number; velocity: number } | null>(null)

  const overlay = () => {
    const prev = sheetRef.current?.previousElementSibling
    return prev instanceof HTMLElement && prev.classList.contains('sheet-overlay') ? prev : null
  }

  const handlers = {
    onTouchStart(e: React.TouchEvent) {
      const sheet = sheetRef.current
      if (window.innerWidth >= 640 || !sheet || e.touches.length !== 1) return
      const y = e.touches[0].clientY
      drag.current = { startY: y, offset: 0, lastY: y, lastT: e.timeStamp, velocity: 0 }
      sheet.style.transition = 'none'
      const dim = overlay()
      if (dim) dim.style.transition = 'none'
    },
    onTouchMove(e: React.TouchEvent) {
      const state = drag.current
      const sheet = sheetRef.current
      if (!state || !sheet) return
      const y = e.touches[0].clientY
      const dy = y - state.startY
      // Upward, it gives a little and stops, as a sheet at its detent does.
      state.offset = dy >= 0 ? dy : -Math.min(12, Math.sqrt(-dy) * 1.5)
      const dt = e.timeStamp - state.lastT
      if (dt > 0) state.velocity = (y - state.lastY) / dt
      state.lastY = y
      state.lastT = e.timeStamp
      if (state.offset > 8) dismissKeyboard()
      sheet.style.transform = `translate3d(0, ${state.offset}px, 0)`
      const dim = overlay()
      if (dim) dim.style.opacity = String(1 - Math.max(0, state.offset) / sheet.offsetHeight)
    },
    onTouchEnd() {
      const state = drag.current
      const sheet = sheetRef.current
      drag.current = null
      if (!state || !sheet) return
      const dim = overlay()
      const flicked = state.velocity > DISMISS_VELOCITY && state.offset > 32
      if (state.offset > DISMISS_AT || flicked) {
        // The exit animation has no starting keyframe, so it begins from
        // this inline position.
        closeRef.current?.click()
        return
      }
      sheet.style.transition = SETTLE
      sheet.style.transform = ''
      if (dim) {
        dim.style.transition = 'opacity 360ms var(--sheet-ease)'
        dim.style.opacity = ''
      }
      // Hand transitions back to the stylesheet (the keyboard-driven height)
      // once it has settled.
      window.setTimeout(() => {
        if (drag.current) return
        sheet.style.transition = ''
        if (dim) dim.style.transition = ''
      }, 380)
    },
  }

  return { sheetRef, closeRef, handlers: { ...handlers, onTouchCancel: handlers.onTouchEnd } }
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    hideClose?: boolean
    /** false hands the whole sheet to the caller, unpadded (⌘K). */
    padded?: boolean
    /**
     * Let the first field take focus as the sheet opens. Off by default on a
     * phone: a keyboard that throws itself up over the sheet before you have
     * read it is the single worst thing a mobile form does. A search palette
     * is the exception — that's what it's for.
     */
    autoFocusOnOpen?: boolean
    /**
     * On a phone, hold the sheet at its detent (three quarters of the screen)
     * whatever its content, instead of fitting a short sheet to what's in it.
     * For long forms and multi-step sheets, which would otherwise change
     * height as their content does.
     */
    tall?: boolean
  }
>(({ className, children, hideClose, padded = true, autoFocusOnOpen, tall, ...props }, ref) => {
  const { sheetRef, closeRef, handlers } = useSheetDrag()
  const isMobile = useIsMobile()
  const [scrolled, setScrolled] = React.useState(false)

  // A sheet arriving is a physical event on iOS — it gets the same soft
  // knock UIKit gives a presented view controller.
  React.useEffect(() => {
    impactFeedback()
  }, [])

  /*
   * A sheet is three regions, not one scrolling block: the title stays
   * readable, the action stays reachable, and only the form between them
   * moves. Scrolling all three together is what put the Save button below
   * the keyboard and made the whole thing feel like a web page.
   */
  const parts = React.Children.toArray(children)
  const isKind = (child: React.ReactNode, kind: React.ElementType) =>
    React.isValidElement(child) && child.type === kind
  const header = parts.filter((c) => isKind(c, DialogHeader))
  const footer = parts.filter((c) => isKind(c, DialogFooter))
  const body = parts.filter((c) => !isKind(c, DialogHeader) && !isKind(c, DialogFooter))

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={(node) => {
          sheetRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        onOpenAutoFocus={(e) => {
          if (!isMobile || autoFocusOnOpen) return
          e.preventDefault()
          sheetRef.current?.focus()
        }}
        className={cn(
          'fixed z-50 flex flex-col bg-background shadow-modal outline-none',
          // Mobile: a bottom sheet, at the corner radius iOS gives one, three
          // quarters of the screen at most (`.sheet`, index.css). It never
          // leaves the bottom edge: the keyboard rises *over* it, the sheet
          // grows by the keyboard's height on the keyboard's curve, and a
          // spacer at its foot (below) keeps the content above the keyboard.
          'sheet inset-x-0 bottom-0 w-full rounded-t-[16px]',
          tall && 'sheet-tall',
          // Desktop: a centred window, 10px radius, hairline + soft shadow.
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:h-auto sm:max-h-[92vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-modal',
          'sm:duration-base sm:ease-out sm:data-[state=open]:animate-in sm:data-[state=closed]:animate-out sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0',
          'sm:data-[state=open]:zoom-in-[0.98] sm:data-[state=closed]:zoom-out-[0.98]',
          className,
        )}
        {...props}
      >
        <div
          {...handlers}
          aria-hidden
          className="flex shrink-0 touch-none justify-center pb-1 pt-2 sm:hidden"
        >
          <span className="h-[5px] w-9 rounded-full bg-foreground/25" />
        </div>

        {header.length > 0 && (
          <div
            {...handlers}
            className={cn(
              'shrink-0 border-b border-transparent transition-colors duration-base',
              // The bar picks up a hairline once content passes beneath it.
              scrolled && 'border-border',
              padded && 'px-5 pb-3 pt-2 sm:px-6 sm:pt-5',
            )}
          >
            {header}
          </div>
        )}

        <div
          onScroll={(e) => {
            const next = e.currentTarget.scrollTop > 2
            setScrolled((prev) => (prev === next ? prev : next))
          }}
          className={cn(
            'scroll-native min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain scrollbar-thin',
            padded && 'px-5 sm:px-6',
            padded && header.length === 0 && 'pt-5',
            padded &&
              footer.length === 0 &&
              'keyboard-padding pb-[max(1.25rem,var(--safe-bottom))] sm:pb-6',
          )}
        >
          {body}
        </div>

        {footer.length > 0 && (
          <div
            className={cn(
              'shrink-0 border-t bg-inherit',
              padded &&
                'keyboard-padding px-5 pb-[max(1.25rem,var(--safe-bottom))] pt-3 sm:px-6 sm:pb-6',
            )}
          >
            {footer}
          </div>
        )}

        {/* Room for the keyboard, filled with the sheet's own background —
            so there is never a strip of the dimmed app between the sheet and
            the keyboard while either is moving. */}
        <div aria-hidden className="keyboard-spacer shrink-0 sm:hidden" />

        {!hideClose && (
          <DialogPrimitive.Close
            className={cn(
              // 28px visually (matches the header it sits in), but expanded
              // to a 44x44pt tap target the same way Button's icon-sm does —
              // see the comment there.
              'absolute right-3 top-4 z-10 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none',
              "before:absolute before:-inset-2 before:content-['']",
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}

        <DialogPrimitive.Close
          ref={closeRef}
          aria-hidden
          tabIndex={-1}
          className="hidden"
        />
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

/**
 * The bar iOS puts across the top of a sheet: a text action at each end and
 * the title between them. Used with `hideClose` and `padded={false}`, inside
 * a `DialogHeader`.
 */
function SheetBar({
  leading,
  title,
  trailing,
}: {
  leading?: React.ReactNode
  title: React.ReactNode
  trailing?: React.ReactNode
}) {
  return (
    <div className="grid h-11 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center px-2">
      <div className="flex justify-start">{leading}</div>
      <DialogTitle className="text-ios-headline sm:text-ios-headline truncate px-1 text-center">
        {title}
      </DialogTitle>
      <div className="flex justify-end">{trailing}</div>
    </div>
  )
}

/**
 * A text button in a `SheetBar`. `strong` is the sheet's confirming action
 * (Add, Save, Done), set in semibold as iOS sets it; `close` makes it dismiss
 * the sheet.
 */
const SheetBarButton = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { strong?: boolean; close?: boolean }
>(({ strong, close, className, onClick, ...props }, ref) => {
  const button = (
    <button
      ref={ref}
      type="button"
      onClick={(e) => {
        tapFeedback()
        onClick?.(e)
      }}
      className={cn(
        'press text-ios-body max-w-full truncate px-2 py-2 text-brand disabled:text-muted-foreground/50',
        strong && 'font-semibold',
        className,
      )}
      {...props}
    />
  )
  return close ? <DialogClose asChild>{button}</DialogClose> : button
})
SheetBarButton.displayName = 'SheetBarButton'

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('flex flex-col gap-1 text-left', className)} {...props} />
  )
}

function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2',
        // 44pt minimum tap targets, full width, the way iOS stacks the
        // actions at the bottom of a sheet.
        '[&>button]:h-11 [&>button]:w-full [&>button]:rounded-[12px]',
        'sm:[&>button]:h-8 sm:[&>button]:w-auto sm:[&>button]:rounded-md',
        className,
      )}
      {...props}
    />
  )
}

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-ios-title3 sm:text-lg sm:font-semibold sm:tracking-[-0.01em]', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

/**
 * The sheet's standing instructions — which stop being worth two lines of a
 * shortened screen the moment someone is typing into the form below them, so
 * on a phone they fold away as the keyboard comes up (`.keyboard-collapse`),
 * on its curve, instead of disappearing in a single frame.
 */
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const description = (
    <DialogPrimitive.Description
      ref={ref}
      className={cn('text-ios-subhead text-muted-foreground sm:text-sm', className)}
      {...props}
    />
  )
  if (className?.includes('sr-only')) return description
  return (
    <div className="keyboard-collapse">
      <div>{description}</div>
    </div>
  )
})
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  SheetBar,
  SheetBarButton,
}
