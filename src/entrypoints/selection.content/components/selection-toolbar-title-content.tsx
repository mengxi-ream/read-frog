import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { cn } from "@/utils/styles/utils"

export function SelectionToolbarTitleContent({
  className,
  icon,
  title,
}: {
  className?: string
  icon: string
  title: ReactNode
}) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <Icon icon={icon} strokeWidth={0.8} className="size-4.5 shrink-0 text-muted-foreground" />
      <SelectionPopover.Title className="truncate">
        {title}
      </SelectionPopover.Title>
    </div>
  )
}
