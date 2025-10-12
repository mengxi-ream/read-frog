import { cn } from '@repo/ui/lib/utils'
import * as React from 'react'

// TODO: Remove 'popover' Omit when Radix UI supports React 19.2
// React 19.2 added "hint" value to popover attribute, but Radix UI doesn't support it yet
function Textarea({ className, ...props }: Omit<React.ComponentProps<'textarea'>, 'popover'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
