import { Icon } from "@iconify/react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { cn } from "@/utils/styles/utils"

export function SelectionToolbarTitleContent({
  className,
  icon,
  title,
}: {
  className?: string
  icon: React.ReactNode | string
  title: React.ReactNode
}) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      {typeof icon === "string"
        ? (
            <Icon icon={icon} strokeWidth={0.8} className="size-4.5 shrink-0 text-zinc-600 dark:text-zinc-400" />
          )
        : (
            icon
          )}
      <SelectionPopover.Title className="truncate">
        {title}
      </SelectionPopover.Title>
    </div>
  )
}
