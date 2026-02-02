import type { VariantProps } from 'class-variance-authority'
import type { badgeVariants } from '@/components/base-ui/badge'
import { Badge } from '@/components/base-ui/badge'

type BetaBadgeProps = Pick<VariantProps<typeof badgeVariants>, 'size'>
  & { className?: string }

export function BetaBadge({ size, className }: BetaBadgeProps) {
  return (
    <Badge variant="secondary" size={size} className={className}>
      Beta
    </Badge>
  )
}
