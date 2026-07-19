import { IconBookOff } from "@tabler/icons-react"
import { useAtomValue } from "jotai"
import { useCallback, useState } from "react"
import { toastManager } from "@/components/ui/base-ui/toast"
import { i18n } from "@/utils/i18n"
import { markWordAsKnown } from "@/utils/vocabulary/gloss-service"
import { getLeadingWord } from "@/utils/vocabulary/leading-word"
import { SelectionToolbarTooltip, useSelectionTooltipState } from "../components/selection-tooltip"
import { selectionContentAtom } from "./atoms"

/**
 * Only rendered in vocabulary mode: marks the leading word of the current
 * selection as known so it stops getting an inline gloss.
 */
export function MarkKnownWordButton() {
  const selectionContent = useAtomValue(selectionContentAtom)
  const [isMarking, setIsMarking] = useState(false)
  const {
    handlePress,
    onOpenChange: handleTooltipOpenChange,
    open: tooltipOpen,
  } = useSelectionTooltipState()

  const word = getLeadingWord(selectionContent)

  const handleClick = useCallback(async () => {
    if (!word || isMarking) return

    handlePress()
    setIsMarking(true)
    try {
      await markWordAsKnown(word)
      toastManager.add({ type: "success", title: i18n.t("vocabulary.markedKnown", [word]) })
    } finally {
      setIsMarking(false)
    }
  }, [handlePress, isMarking, word])

  if (!word) return null

  return (
    <SelectionToolbarTooltip
      content={i18n.t("vocabulary.markKnownTooltip")}
      open={tooltipOpen}
      onOpenChange={handleTooltipOpenChange}
      render={
        <button
          type="button"
          className="flex h-7 cursor-pointer items-center justify-center px-2 hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
          onClick={handleClick}
          disabled={isMarking}
          aria-label={i18n.t("vocabulary.markKnownTooltip")}
        />
      }
    >
      <IconBookOff className="size-4.5" strokeWidth={1.6} />
    </SelectionToolbarTooltip>
  )
}
