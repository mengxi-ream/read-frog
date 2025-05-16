import type { LucideIcon } from 'lucide-react'

export default function HiddenButton({
  Icon,
  onClick,
  children,
}: {
  Icon: LucideIcon
  onClick: () => void
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="border-border mr-2 translate-x-12 cursor-pointer rounded-full border bg-white p-1.5 text-neutral-600 transition-transform duration-300 group-hover:translate-x-0 hover:bg-neutral-100 dark:bg-neutral-900 dark:hover:bg-neutral-800"
      onClick={onClick}
    >
      <Icon className="h-5 w-5" strokeWidth={1.8} />
      {children}
    </button>
  )
}
