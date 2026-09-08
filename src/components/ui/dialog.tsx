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
          'fixed z-50 grid gap-4 bg-background p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-modal',
          // Mobile: a bottom sheet.
          'inset-x-0 bottom-0 w-full max-h-[92dvh] overflow-y-auto overscroll-contain scrollbar-thin rounded-t-[12px]',
          // Desktop: a centred window, 10px radius, hairline + soft shadow.
          'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:max-h-[92vh] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-modal sm:p-6',
          'duration-base ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=open]:slide-in-from-bottom-6 data-[state=closed]:slide-out-to-bottom-6',
          'sm:data-[state=open]:slide-in-from-bottom-0 sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:zoom-in-[0.98] sm:data-[state=closed]:zoom-out-[0.98]',
          className,
        )}
        {...props}
      >
        <div
          {...handlers}
          aria-hidden
          className="-mb-1 -mt-2 flex touch-none justify-center pb-1 sm:hidden"
        >
          <span className="h-1 w-9 rounded-full bg-foreground/20" />
        </div>

        {children}
        {!hideClose && (
          <DialogPrimitive.Close className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-fast hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:pointer-events-none">
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
    className={cn('text-lg font-semibold leading-tight tracking-[-0.01em]', className)}
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
