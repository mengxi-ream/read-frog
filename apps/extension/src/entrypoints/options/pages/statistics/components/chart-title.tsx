import { Icon } from '@iconify/react'
import { cn } from '@repo/ui/lib/utils'
import { chartTitle } from './primitives'

export default function ChartTitle({
  title,
  icon,
  className,
  iconClassName,
}: {
  title: string
  icon?: string
  className?: string
  iconClassName?: string
}) {
  return (
    <h2 className={cn(chartTitle({}), 'flex items-center', className)}>
      {icon && <Icon icon={icon} className={cn('text-primary mr-2 shrink-0', iconClassName)} />}
      {' '}
      {title}
    </h2>
  )
}
