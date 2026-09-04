import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
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
      'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

/** How far the sheet has to travel before letting go dismisses it. */
const DISMISS_AT = 110

/**
 * Swipe-down-to-dismiss for the phone's bottom sheet.
 *
 * The grabber at the top of a sheet is a promise that it can be dragged; a
 * grabber that does nothing is the single most obvious tell that a "native"
 * sheet is a web dialog. This makes it true — the sheet tracks the finger,
 * springs back if the drag was small, and closes if it wasn't.
 */
function useSheetDrag() {
  const sheetRef = React.useRef<HTMLDivElement | null>(null)
  const closeRef = React.useRef<HTMLButtonElement | null>(null)
  const startY = React.useRef<number | null>(null)
  const offset = React.useRef(0)

  const handlers = {
    onTouchStart(e: React.TouchEvent) {
      // Above `sm` the dialog is a centred desktop window, not a sheet.
      if (window.innerWidth >= 640) return
      startY.current = e.touches[0].clientY
      offset.current = 0
      if (sheetRef.current) sheetRef.current.style.transition = 'none'
    },
    onTouchMove(e: React.TouchEvent) {
      if (startY.current === null || !sheetRef.current) return
      // Downward only: dragging up would just detach the sheet from the edge.
      offset.current = Math.max(0, e.touches[0].clientY - startY.current)
      sheetRef.current.style.transform = `translateY(${offset.current}px)`
    },
    onTouchEnd() {
      const sheet = sheetRef.current
      if (startY.current === null || !sheet) return
      startY.current = null
      // The deceleration curve iOS uses for sheets.
      sheet.style.transition = 'transform 240ms cubic-bezier(0.32, 0.72, 0, 1)'
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
  }
>(({ className, children, hideClose, ...props }, ref) => {
  const { sheetRef, closeRef, handlers } = useSheetDrag()

  return (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={(node) => {
        sheetRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      className={cn(
        'fixed z-50 grid gap-4 border bg-background p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-lg',
        // Mobile: a bottom sheet — full width, pinned to the bottom edge,
        // rounded top, slides up. This is the native-feeling default.
        'inset-x-0 bottom-0 w-full max-h-[92dvh] overflow-y-auto overscroll-contain scrollbar-thin rounded-t-[1.25rem]',
        // Desktop: a classic centered dialog.
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:max-h-[92vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg',
        // Animation: fade + slide-up on mobile; fade + gentle zoom on desktop
        // (never a side fly-in).
        'duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
        'data-[state=open]:slide-in-from-bottom-8 data-[state=closed]:slide-out-to-bottom-8',
        'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95',
        className,
      )}
      {...props}
    >
      {/* The grabber. Mobile only — on a desktop the sheet is a window. */}
      <div
        {...handlers}
        aria-hidden
        className="-mb-1 -mt-3 flex touch-none justify-center pb-1 sm:hidden"
      >
        <span className="h-1 w-9 rounded-full bg-foreground/20" />
      </div>

      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground opacity-80 ring-offset-background transition-opacity hover:bg-accent hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}

      {/* The drag's way of asking Radix to close, so the exit animation, focus
          restoration and scroll lock all still run. */}
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

function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex flex-col space-y-1.5 text-center sm:text-left',
        className,
      )}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        // Mobile: stacked, full-width, easy-to-tap buttons (primary on top).
        // Desktop: right-aligned row.
        'flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2',
        '[&>button]:w-full sm:[&>button]:w-auto',
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
    className={cn(
      'text-lg font-semibold leading-none tracking-tight',
      className,
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
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
