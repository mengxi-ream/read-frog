import { RiTranslate } from "@remixicon/react"
import { i18n } from "#imports"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SelectionToolbarTooltip } from "../../components/selection-tooltip"
import { useSelectionTranslationPopover } from "./provider"

export function TranslateButton() {
  const { prepareToolbarOpen, reTriggerTranslation } = useSelectionTranslationPopover()
  const triggerLabel = i18n.t("action.translation")

  return (
    <SelectionToolbarTooltip
      content={triggerLabel}
      render={(
        <SelectionPopover.Trigger
          aria-label={triggerLabel}
          onReTrigger={reTriggerTranslation}
          onClick={(event) => {
            event.currentTarget.blur()
            prepareToolbarOpen()
          }}
        />
      )}
    >
      <RiTranslate className="size-4.5" />
    </SelectionToolbarTooltip>
  )
}
