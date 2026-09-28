import { useAtomValue } from "jotai"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { getSelectionToolbarItems } from "@/utils/selection-toolbar-items"
import { SelectionToolbarCustomActionTrigger } from "./custom-action-button/custom-action-trigger"
import { SpeakButton } from "./speak-button"
import { TranslateButton } from "./translate-button"

// The buttons of the enabled items pinned to the toolbar, in the toolbar's
// order. The other enabled items are in its "more" menu only.
export function SelectionToolbarPinnedItems() {
  const selectionToolbar = useAtomValue(configFieldsAtomMap.selectionToolbar)

  return getSelectionToolbarItems(selectionToolbar)
    .filter((item) => item.enabled && item.pinned)
    .map((item) => {
      if (item.kind === "action") {
        return <SelectionToolbarCustomActionTrigger key={item.id} action={item.action} />
      }
      return item.id === "translate" ? (
        <TranslateButton key={item.id} />
      ) : (
        <SpeakButton key={item.id} />
      )
    })
}
