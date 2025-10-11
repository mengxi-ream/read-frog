import { cn } from '@repo/ui/lib/utils'
import * as React from 'react'

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
