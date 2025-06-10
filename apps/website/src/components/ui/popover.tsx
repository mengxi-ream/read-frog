'use client'
import * as PopoverPrimitive from '@radix-ui/react-popover'
import * as React from 'react'
import { cn } from '../../lib/cn'

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({ ref, className, align = 'center', sideOffset = 4, ...props }: React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & { ref?: React.RefObject<React.ComponentRef<typeof PopoverPrimitive.Content> | null> }) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        side="bottom"
        className={cn(
          'z-50 min-w-[220px] max-w-[98vw] rounded-lg border bg-fd-popover p-2 text-sm text-fd-popover-foreground shadow-lg focus-visible:outline-none data-[state=closed]:animate-fd-popover-out data-[state=open]:animate-fd-popover-in',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}
PopoverContent.displayName = PopoverPrimitive.Content.displayName

const PopoverClose = PopoverPrimitive.PopoverClose

export { Popover, PopoverClose, PopoverContent, PopoverTrigger }
