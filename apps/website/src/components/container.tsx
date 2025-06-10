import * as React from 'react'
import { cn } from '@/lib/cn'

function Container({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="container"
      className={cn(
        'relative mx-auto w-full max-w-6xl px-6 md:px-14',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { Container }
