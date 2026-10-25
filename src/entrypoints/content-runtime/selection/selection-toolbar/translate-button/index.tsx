import { RiTranslate } from "@remixicon/react"
import { useAtomValue } from "jotai"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { SelectionToolbarTooltip } from "@/components/ui/selection-popover/selection-tooltip"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { ShortcutTooltipLabel } from "../shortcut-hint"
import { useSelectionTranslationPopover } from "./provider"

export function TranslateButton() {
  const { prepareToolbarOpen } = useSelectionTranslationPopover()
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const triggerLabel = i18n.t("action.translation")

  return (
    <SelectionToolbarTooltip
      content={
        <ShortcutTooltipLabel
          label={triggerLabel}
          shortcut={selectionToolbar.features.translate.shortcut}
        />
      }
      render={
        <SelectionPopover.Trigger
          aria-label={triggerLabel}
          onClick={(event) => {
            event.currentTarget.blur()
            prepareToolbarOpen()
          }}
        />
      }
    >
      <RiTranslate className="size-4.5" />
    </SelectionToolbarTooltip>
  )
}
