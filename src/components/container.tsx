import { forwardRef } from 'react'

import { cn } from '@/utils/tailwind'

const Container = forwardRef<
  HTMLDivElement,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, children, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(
        'max-w-8xl mx-auto w-full px-6 md:px-10 lg:px-14',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
})

export default Container
