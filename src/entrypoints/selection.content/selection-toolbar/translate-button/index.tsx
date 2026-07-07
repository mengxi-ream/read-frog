import { RiTranslate } from "@remixicon/react"
import { useAtomValue } from "jotai"
import { Kbd, KbdGroup } from "@/components/ui/base-ui/kbd"
import { SelectionPopover } from "@/components/ui/selection-popover"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { formatHotkeyParts } from "@/utils/os"
import { isPageTranslationShortcutEmpty } from "@/utils/page-translation-shortcut"
import { SelectionToolbarTooltip } from "../../components/selection-tooltip"
import { useSelectionTranslationPopover } from "./provider"

export function TranslateButton() {
  const { prepareToolbarOpen } = useSelectionTranslationPopover()
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)
  const triggerLabel = i18n.t("action.translation")
  const shortcut = selectionToolbar.features.translate.shortcut
  const shortcutParts = isPageTranslationShortcutEmpty(shortcut) ? [] : formatHotkeyParts(shortcut)
  const tooltipContent = shortcutParts.length > 0
    ? (
        <span className="inline-flex items-center gap-2">
          <span>{triggerLabel}</span>
          <KbdGroup>
            {shortcutParts.map(part => <Kbd key={part}>{part}</Kbd>)}
          </KbdGroup>
        </span>
      )
    : triggerLabel

  return (
    <SelectionToolbarTooltip
      content={tooltipContent}
      render={(
        <SelectionPopover.Trigger
          aria-label={triggerLabel}
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
