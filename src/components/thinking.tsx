import type { ThinkingSnapshot } from "@/types/background-stream"
import { i18n } from "#imports"
import { IconChevronDown } from "@tabler/icons-react"
import { useEffect, useRef, useState } from "react"
import { ThinkingIcon } from "@/components/icons/thinking-icon"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/base-ui/collapsible"
import { cn } from "@/utils/styles/utils"

interface ThinkingProps {
  status: ThinkingSnapshot["status"]
  content?: string | null
  defaultExpanded?: boolean
  className?: string
}

const AUTO_SCROLL_BOTTOM_THRESHOLD = 8

export function Thinking({
  status,
  content,
  defaultExpanded = false,
  className,
}: ThinkingProps) {
  const [open, setOpen] = useState(defaultExpanded)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const shouldAutoScrollRef = useRef(true)
  const trimmedContent = content?.trim() ?? ""
  const hasContent = trimmedContent.length > 0
  const isThinking = status === "thinking"
  const statusLabel = isThinking
    ? i18n.t("thinking.label")
    : i18n.t("thinking.complete")
  const containerClassName = cn(
    "rounded-lg border border-border/70 bg-muted/30 text-muted-foreground",
    className,
  )
  const triggerClassName = "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-xs"
  const thinkingIconClassName = cn(
    "shrink-0",
    isThinking ? "text-primary" : "text-muted-foreground",
  )

  useEffect(() => {
    if (open) {
      shouldAutoScrollRef.current = true
    }
  }, [open])

  useEffect(() => {
    if (!open || !shouldAutoScrollRef.current) {
      return
    }

    const frame = requestAnimationFrame(() => {
      const node = contentRef.current
      if (!node) {
        return
      }

      node.scrollTop = node.scrollHeight
    })

    return () => {
      cancelAnimationFrame(frame)
    }
  }, [open, trimmedContent])

  const handleContentScroll = () => {
    const node = contentRef.current
    if (!node) {
      return
    }

    const distanceToBottom = node.scrollHeight - node.scrollTop - node.clientHeight
    if (distanceToBottom > AUTO_SCROLL_BOTTOM_THRESHOLD) {
      shouldAutoScrollRef.current = false
    }
  }

  if (!hasContent) {
    return (
      <div className={containerClassName}>
        <div className={triggerClassName}>
          <span className="flex min-w-0 items-center gap-2">
            <ThinkingIcon animated={isThinking} className={thinkingIconClassName} />
            <span className="font-medium tracking-[0.01em]">{statusLabel}</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={containerClassName}
    >
      <CollapsibleTrigger
        className={triggerClassName}
        aria-label={open ? i18n.t("thinking.collapse") : i18n.t("thinking.expand")}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ThinkingIcon
            animated={isThinking}
            className={thinkingIconClassName}
          />
          <span className="font-medium tracking-[0.01em]">{statusLabel}</span>
        </span>
        <IconChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </CollapsibleTrigger>
      <CollapsibleContent
        ref={contentRef}
        className="max-h-32 overflow-y-auto px-3 pb-2.5"
        onScroll={handleContentScroll}
      >
        <p className="text-xs whitespace-pre-wrap wrap-break-words text-muted-foreground">
          {trimmedContent}
        </p>
      </CollapsibleContent>
    </Collapsible>
  )
}
