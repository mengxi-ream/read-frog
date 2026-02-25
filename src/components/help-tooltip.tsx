import type { ReactNode } from "react"
import { Icon } from "@iconify/react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { cn } from "@/lib/utils"

export function HelpTooltip({ children, contentClassName }: { children: ReactNode, contentClassName?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex items-center" />}>
        <Icon icon="tabler:help" className="size-3 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className={cn("max-w-64", contentClassName)}>
        <p>{children}</p>
      </TooltipContent>
    </Tooltip>
  )
}
