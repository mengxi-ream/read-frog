import { useAtomValue } from "jotai"
import { configAtom } from "@/utils/atoms/config"
import { getSelectionToolbarItems } from "@/utils/selection-toolbar-items"
import { SelectionToolbarCustomActionTrigger } from "./custom-action-button/custom-action-trigger"
import { SpeakButton } from "./speak-button"
import { TranslateButton } from "./translate-button"

// The buttons of the shown items pinned to the toolbar, in the toolbar's
// order. The other shown items are in its "more" menu only.
export function SelectionToolbarPinnedItems() {
  const config = useAtomValue(configAtom)

  return getSelectionToolbarItems(config)
    .filter((item) => item.shown && item.pinned)
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
