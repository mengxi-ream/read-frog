import { i18n } from "#imports"
import { IconCheck, IconCopy } from "@tabler/icons-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { buttonVariants } from "@/components/ui/base-ui/button"
import { cn } from "@/utils/styles/utils"
import { SelectionPopoverTooltip, useSelectionTooltipState } from "./selection-tooltip"

export function CopyButton({ text }: { text: string | undefined }) {
  const [copied, setCopied] = useState(false)
  const { handlePress, onOpenChange: handleTooltipOpenChange, open: tooltipOpen } = useSelectionTooltipState()
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
    handlePress()
    if (timerRef.current)
      clearTimeout(timerRef.current)
    timerRef.current = setTimeout(setCopied, 1500, false)
  }, [handlePress, text])

  return (
    <SelectionPopoverTooltip
      content={copied ? i18n.t("action.copied") : i18n.t("action.copy")}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
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
    </SelectionPopoverTooltip>
  )
}
