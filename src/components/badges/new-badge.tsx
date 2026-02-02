import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/base-ui/badge'
import { Badge } from '@/components/base-ui/badge'

type NewBadgeProps = Pick<VariantProps<typeof badgeVariants>, 'size'> & { className?: string }

export function NewBadge({ size, className }: NewBadgeProps) {
  return (
    <Badge variant="accent" size={size} className={className}>
      New
    </Badge>
  )
}
