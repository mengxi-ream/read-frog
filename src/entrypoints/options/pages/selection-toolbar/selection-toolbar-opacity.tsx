import { i18n } from "#imports"
import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { Slider } from "@/components/ui/base-ui/slider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { MAX_SELECTION_OVERLAY_OPACITY, MIN_SELECTION_OVERLAY_OPACITY } from "@/utils/constants/selection"
import { ConfigCard } from "../../components/config-card"

export function SelectionToolbarOpacity() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const [draftOpacity, setDraftOpacity] = useState(selectionToolbar.opacity)

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setDraftOpacity(selectionToolbar.opacity)
  }, [selectionToolbar.opacity])

  return (
    <ConfigCard
      id="selection-toolbar-opacity"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.opacity.title")}
      description={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.opacity.description")}
    >
      <div className="w-full flex items-center gap-2">
        <Slider
          min={MIN_SELECTION_OVERLAY_OPACITY}
          max={MAX_SELECTION_OVERLAY_OPACITY}
          step={1}
          value={draftOpacity}
          onValueChange={(value) => {
            setDraftOpacity(value as number)
          }}
          onValueCommitted={(value) => {
            void setSelectionToolbar({ opacity: value as number })
          }}
          className="flex-1"
        />
        <span className="w-10 text-sm text-right">
          {draftOpacity}
          %
        </span>
      </div>
    </ConfigCard>
  )
}
