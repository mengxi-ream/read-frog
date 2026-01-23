import type { IconProps } from '@tabler/icons-react'
import { IconLoader2 } from '@tabler/icons-react'
import { cn } from '@/utils/styles/utils'

function Spinner({ className, ...props }: IconProps) {
  return (
    <IconLoader2
      role="status"
      aria-label="Loading"
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  )
}

export { Spinner }
