import { IconChevronDown, IconChevronUp } from "@tabler/icons-react"
import { Activity, useState } from "react"
import { Button } from "@/components/ui/base-ui/button"
import { Separator } from "@/components/ui/base-ui/separator"
import { cn } from "@/utils/styles/utils"
import { CopyButton } from "./copy-button"
import { SpeakButton } from "./speak-button"

interface SelectionSourceContentProps {
  text: string | null | undefined
  defaultExpanded?: boolean
  emptyPlaceholder?: string
  separatorClassName?: string
}

export function SelectionSourceContent({
  text,
  defaultExpanded = false,
  emptyPlaceholder,
  separatorClassName,
}: SelectionSourceContentProps) {
  const [actionsExpanded, setActionsExpanded] = useState(defaultExpanded)
  const displayText = text || emptyPlaceholder || ""

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm whitespace-pre-wrap wrap-break-words text-zinc-600 dark:text-zinc-400">
            {displayText}
          </p>
          <Button
            variant="ghost-secondary"
            size="icon-xs"
            className="size-5.5 shrink-0"
            onClick={() => setActionsExpanded(prev => !prev)}
          >
            <Activity mode={actionsExpanded ? "visible" : "hidden"}>
              <IconChevronUp />
            </Activity>
            <Activity mode={actionsExpanded ? "hidden" : "visible"}>
              <IconChevronDown />
            </Activity>
          </Button>
        </div>
        <Activity mode={actionsExpanded ? "visible" : "hidden"}>
          <div className="flex items-center gap-1">
            <CopyButton text={text ?? undefined} />
            <SpeakButton text={text ?? undefined} />
          </div>
        </Activity>
      </div>
      <Separator className={cn("opacity-60", actionsExpanded ? "mt-1.5" : "mt-3", separatorClassName)} />
    </>
  )
}
