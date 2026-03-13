import { Toaster } from "sonner"
import { useInputTranslation } from "./input-translation"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "./overlay-layers"
import { SelectionToolbar } from "./selection-toolbar"

export default function App() {
  useInputTranslation()

  return (
    <>
      <SelectionToolbar />
      <Toaster richColors className={`${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay} notranslate`} />
    </>
  )
}
