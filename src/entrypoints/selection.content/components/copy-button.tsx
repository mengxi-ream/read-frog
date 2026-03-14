import { i18n } from "#imports"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/base-ui/tooltip"
import { useSelectionPopoverOverlayProps } from "@/components/ui/selection-popover"
import { cn } from "@/utils/styles/utils"

const TOOLTIP_TRIGGER_PRESS_REASON = "trigger-press"

export function CopyButton({ text }: { text: string | undefined }) {
  const popoverOverlay = useSelectionPopoverOverlayProps()
  const [copied, setCopied] = useState(false)
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    return () => {
      if (timerRef.current)
        clearTimeout(timerRef.current)
    }
  }, [])

  const handleCopy = useCallback(() => {
    if (!text)
      return
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTooltipOpen(true)
    if (timerRef.current)
      clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setCopied(false), 1500)
  }, [text])

  const handleTooltipOpenChange = useCallback((nextOpen: boolean, eventDetails: { reason: string }) => {
    if (!nextOpen && eventDetails.reason === TOOLTIP_TRIGGER_PRESS_REASON) {
      return
    }

    setTooltipOpen(nextOpen)
  }, [])

  return (
    <Tooltip open={tooltipOpen} onOpenChange={handleTooltipOpenChange}>
      <TooltipTrigger
        render={(
          <button
            type="button"
            className={cn(buttonVariants({ variant: "ghost-secondary", size: "icon-sm" }))}
            onClick={handleCopy}
          />
        )}
      >
        {copied
          ? <IconCheck className="text-green-500" />
          : <IconCopy />}
      </TooltipTrigger>
      <TooltipContent
        className="whitespace-nowrap"
        container={popoverOverlay.container}
        positionerClassName={popoverOverlay.positionerClassName}
      >
        {copied ? i18n.t("action.copied") : i18n.t("action.copy")}
      </TooltipContent>
    </Tooltip>
  )
}
