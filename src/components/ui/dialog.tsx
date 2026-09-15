import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useIsMobile } from '@/hooks/useIsMobile'
import { impactFeedback } from '@/lib/haptics'
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
      'fixed inset-0 z-50 bg-black/40 duration-fast data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 dark:bg-black/60',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** How far the sheet has to travel before letting go dismisses it. */
const DISMISS_AT = 110


/**
 * Swipe-down-to-dismiss for the phone's bottom sheet. The grabber at the top
 * of a sheet is a promise that it can be dragged; this makes it true.
 */
function useSheetDrag() {
  const sheetRef = React.useRef<HTMLDivElement | null>(null)
  const closeRef = React.useRef<HTMLButtonElement | null>(null)
  const startY = React.useRef<number | null>(null)
  const offset = React.useRef(0)

  const handlers = {
    onTouchStart(e: React.TouchEvent) {
      if (window.innerWidth >= 640) return
      startY.current = e.touches[0].clientY
      offset.current = 0
      if (sheetRef.current) sheetRef.current.style.transition = 'none'
    },
    onTouchMove(e: React.TouchEvent) {
      if (startY.current === null || !sheetRef.current) return
      offset.current = Math.max(0, e.touches[0].clientY - startY.current)
      sheetRef.current.style.transform = `translateY(${offset.current}px)`
    },
    onTouchEnd() {
      const sheet = sheetRef.current
      if (startY.current === null || !sheet) return
      startY.current = null
      sheet.style.transition = 'transform 220ms cubic-bezier(0.32, 0.72, 0, 1)'
      if (offset.current > DISMISS_AT) {
        sheet.style.transform = 'translateY(100%)'
        closeRef.current?.click()
      } else {
        sheet.style.transform = ''
      }
    },
  }

  return { sheetRef, closeRef, handlers }
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
  }
>(({ className, children, hideClose, padded = true, autoFocusOnOpen, ...props }, ref) => {
  const { sheetRef, closeRef, handlers } = useSheetDrag()
  const isMobile = useIsMobile()

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
          // Mobile: a bottom sheet, at the corner radius iOS gives one. It
          // never leaves the bottom edge: the keyboard rises *over* it, as it
          // does over a native sheet, and a spacer at its foot (below) grows
          // on the keyboard's curve to keep the content above it. Never
          // reaches under the status bar.
          'inset-x-0 bottom-0 max-h-[calc(100dvh-env(safe-area-inset-top)-0.5rem)] w-full rounded-t-[16px]',
          // Desktop: a centred window, 10px radius, hairline + soft shadow.
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[92vh] sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-modal',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          // The phone's sheet travels its whole height on UIKit's own curve;
          // a 24px peek reads as a web popover dropping into place.
          'duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)]',
          'data-[state=open]:slide-in-from-bottom-[100%] data-[state=closed]:slide-out-to-bottom-[100%]',
          'sm:duration-base sm:ease-out sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0',
          'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-[0.98] sm:data-[state=closed]:zoom-out-[0.98]',
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
          <div className={cn('shrink-0', padded && 'px-5 pb-3 pt-2 sm:px-6 sm:pt-5')}>
            {header}
          </div>
        )}

        <div
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
              'shrink-0 border-t bg-background',
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
}
