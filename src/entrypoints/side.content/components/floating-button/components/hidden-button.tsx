import { Icon } from '@iconify/react'
import { cn } from '@/utils/styles/utils'

export default function HiddenButton({
  icon,
  onClick,
  children,
  className,
}: {
  icon: string
  onClick: () => void
  children?: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      className={cn(
        'border-border mr-2 translate-x-12 cursor-pointer rounded-full border bg-white p-1.5 text-neutral-600 dark:text-neutral-400 transition-transform duration-300 group-hover:translate-x-0 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800',
        className,
      )}
      onClick={onClick}
    >
      <Icon icon={icon} className="h-5 w-5" />
      {children}
    </button>
  )
}
