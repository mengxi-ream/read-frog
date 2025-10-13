import { cn } from '@repo/ui/lib/utils'
import * as React from 'react'

// TODO: Remove 'popover' Omit when Radix UI supports React 19.2
// React 19.2 added "hint" value to popover attribute, but Radix UI doesn't support it yet
function Skeleton({ className, ...props }: Omit<React.ComponentProps<'div'>, 'popover'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
