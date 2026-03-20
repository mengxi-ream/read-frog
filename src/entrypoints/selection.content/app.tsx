import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { Toaster } from "sonner"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { useInputTranslation } from "./input-translation"
import { SELECTION_CONTENT_OVERLAY_LAYERS } from "./overlay-layers"
import { SelectionToolbar } from "./selection-toolbar"
import { SelectionTranslationProvider } from "./selection-toolbar/translate-button/provider"

export default function App({
  uiContainer,
}: {
  uiContainer: HTMLElement
}) {
  useInputTranslation()
  const opacity = useAtomValue(configFieldsAtomMap.selectionToolbar).opacity / 100

  useEffect(() => {
    uiContainer.style.setProperty("--rf-selection-opacity", String(opacity))

    return () => {
      uiContainer.style.removeProperty("--rf-selection-opacity")
    }
  }, [opacity, uiContainer])

  return (
    <>
      <SelectionTranslationProvider>
        <SelectionToolbar />
      </SelectionTranslationProvider>
      <Toaster richColors className={`${SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay} notranslate`} />
    </>
  )
}
