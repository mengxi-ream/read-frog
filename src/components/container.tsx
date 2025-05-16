import { cn } from '@/utils/tailwind'

function Container({ ref, className, children, ...props }: React.ComponentPropsWithoutRef<'div'> & { ref?: React.RefObject<HTMLDivElement | null> }) {
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
}

export default Container
