import { useAtomValue } from "jotai"
import { useEffect } from "react"
import { ToastProvider } from "@/components/ui/base-ui/toast"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { useInputTranslation } from "./input-translation"
import {
  SELECTION_CONTENT_OVERLAY_LAYERS,
  SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE,
} from "./overlay-layers"
import { SelectionToolbar } from "./selection-toolbar"
import { SelectionCustomActionProvider } from "./selection-toolbar/custom-action-button/provider"
import { SelectionTranslationProvider } from "./selection-toolbar/translate-button/provider"
import { useContextMenuReadAloud } from "./use-context-menu-read-aloud"

export default function App({
  uiContainer,
  portalContainer,
}: {
  uiContainer: HTMLElement
  portalContainer: ShadowRoot
}) {
  useInputTranslation()
  useContextMenuReadAloud()
  const opacity = useAtomValue(configFieldsAtomMap.selectionToolbar).opacity / 100

  useEffect(() => {
    uiContainer.style.setProperty("--rf-selection-opacity", String(opacity))

    return () => {
      uiContainer.style.removeProperty("--rf-selection-opacity")
    }
  }, [opacity, uiContainer])

  return (
    <ToastProvider
      portalProps={{ container: portalContainer }}
      viewportProps={{
        className: SELECTION_CONTENT_OVERLAY_LAYERS.selectionOverlay,
        ...{ [SELECTION_CONTENT_OVERLAY_ROOT_ATTRIBUTE]: "" },
      }}
    >
      <SelectionTranslationProvider>
        <SelectionCustomActionProvider>
          <SelectionToolbar />
        </SelectionCustomActionProvider>
      </SelectionTranslationProvider>
    </ToastProvider>
  )
}
