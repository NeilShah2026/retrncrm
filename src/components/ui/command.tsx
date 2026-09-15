import * as React from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

const Command = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'flex h-full w-full flex-col overflow-hidden bg-popover text-popover-foreground',
      className,
    )}
    {...props}
  />
))
Command.displayName = CommandPrimitive.displayName

/**
 * ⌘K. One of the few floating layers, so it gets the modal shadow. Rows are
 * 36px — dense enough to scan, tall enough to tap.
 */
function CommandDialog({ children, ...props }: React.ComponentProps<typeof Dialog>) {
  return (
    <Dialog {...props}>
      <DialogContent
        hideClose
        padded={false}
        autoFocusOnOpen
        aria-describedby={undefined}
        className="gap-0 overflow-hidden p-0 sm:top-[14%] sm:max-w-xl sm:translate-y-0 sm:p-0"
      >
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        <Command className="[&_[cmdk-group-heading]]:text-ios-footnote [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-4 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.05em] [&_[cmdk-group-heading]]:text-muted-foreground sm:[&_[cmdk-group-heading]]:text-label sm:[&_[cmdk-group-heading]]:px-2 sm:[&_[cmdk-group-heading]]:pt-2 sm:[&_[cmdk-group-heading]]:normal-case [&_[cmdk-item]_svg]:h-[18px] [&_[cmdk-item]_svg]:w-[18px] [&_[cmdk-item]_svg]:shrink-0 [&_[cmdk-item]_svg]:text-muted-foreground sm:[&_[cmdk-item]_svg]:h-4 sm:[&_[cmdk-item]_svg]:w-4">
          {children}
        </Command>
      </DialogContent>
    </Dialog>
  )
}

const CommandInput = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Input>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Input>
>(({ className, ...props }, ref) => (
  <div
    className={cn(
      // Phone: the filled, inset search field iOS uses at the top of a list.
      'mx-4 mb-1 mt-1 flex items-center gap-2 rounded-[10px] bg-bg-sunken px-3',
      // Desktop: a flush row with a rule under it, as before.
      'sm:mx-0 sm:mb-0 sm:mt-0 sm:gap-0 sm:rounded-none sm:border-b sm:bg-transparent',
    )}
    cmdk-input-wrapper=""
  >
    <Search className="h-4 w-4 shrink-0 text-muted-foreground sm:mr-2" />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'text-ios-body flex h-11 w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/80 disabled:cursor-not-allowed disabled:opacity-50',
        'sm:py-3 sm:text-sm',
        className,
      )}
      {...props}
    />
  </div>
))
CommandInput.displayName = CommandPrimitive.Input.displayName

const CommandList = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      'scroll-native overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-thin sm:max-h-[360px]',
      // Phone: shortens as the keyboard rises under the sheet, so the last
      // results stay reachable instead of being clipped off its bottom.
      'keyboard-max-height max-h-[min(62dvh,calc(100dvh-var(--kb-height)-env(safe-area-inset-top)-7rem))]',
      className,
    )}
    {...props}
  />
))
CommandList.displayName = CommandPrimitive.List.displayName

const CommandEmpty = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Empty>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    role="status"
    aria-live="polite"
    className="px-4 py-8 text-center text-sm text-muted-foreground"
    {...props}
  />
))
CommandEmpty.displayName = CommandPrimitive.Empty.displayName

const CommandGroup = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Group>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn('overflow-hidden pb-1 text-foreground sm:p-1', className)}
    {...props}
  />
))
CommandGroup.displayName = CommandPrimitive.Group.displayName

const CommandItem = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      'text-ios-body relative flex h-11 cursor-pointer select-none items-center gap-3 rounded-none px-4 outline-none',
      'sm:h-9 sm:gap-2.5 sm:rounded-sm sm:px-2 sm:text-sm',
      'data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground',
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className,
    )}
    {...props}
  />
))
CommandItem.displayName = CommandPrimitive.Item.displayName

/**
 * Right-aligned hint on a row: a date, a count, a category — or, with
 * `keyboard`, the key that runs it, which is hidden on a touch device where
 * there is no key to press.
 */
function CommandShortcut({
  className,
  keyboard,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { keyboard?: boolean }) {
  return (
    <span
      className={cn(
        'ml-auto shrink-0 text-xs tabular-nums text-muted-foreground',
        keyboard && 'hidden sm:inline',
        className,
      )}
      {...props}
    />
  )
}

const CommandSeparator = React.forwardRef<
  React.ElementRef<typeof CommandPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('-mx-1 h-px bg-border', className)}
    {...props}
  />
))
CommandSeparator.displayName = CommandPrimitive.Separator.displayName

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
}
