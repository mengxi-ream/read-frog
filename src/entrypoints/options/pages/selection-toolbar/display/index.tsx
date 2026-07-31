import { useAtom } from "jotai"
import { useEffect, useState } from "react"
import { Slider } from "@/components/ui/base-ui/slider"
import { usePatternList } from "@/hooks/use-pattern-list"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  MAX_SELECTION_OVERLAY_OPACITY,
  MIN_SELECTION_OVERLAY_OPACITY,
} from "@/utils/constants/selection"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"
import { ConfigSection } from "../../../components/config-section"
import { PatternsTable } from "../../../components/patterns-table"

/** How the toolbar looks where it shows, and the sites it stays off entirely. */
export function DisplaySection() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const { disabledSelectionToolbarPatterns } = selectionToolbar

  const { addPattern, removePattern } = usePatternList(
    disabledSelectionToolbarPatterns,
    (nextPatterns) => {
      void setSelectionToolbar({
        ...selectionToolbar,
        disabledSelectionToolbarPatterns: nextPatterns,
      })
    },
  )

  return (
    <ConfigSection
      id="selection-toolbar-display"
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.display.title")}
    >
      <ConfigItem
        id="selection-toolbar-opacity"
        title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.display.opacity.title")}
        description={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.display.opacity.description",
        )}
      >
        <OpacitySlider
          value={selectionToolbar.opacity}
          onValueCommitted={(opacity) => {
            void setSelectionToolbar({ opacity })
          }}
        />
      </ConfigItem>
      <ConfigItem
        id="selection-toolbar-disabled-sites"
        orientation="vertical"
        title={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.display.disabledSites.title",
        )}
        description={i18n.t(
          "options.floatingButtonAndToolbar.selectionToolbar.display.disabledSites.description",
        )}
      >
        <PatternsTable
          patterns={disabledSelectionToolbarPatterns}
          onAddPattern={addPattern}
          onRemovePattern={removePattern}
          placeholderText={i18n.t(
            "options.floatingButtonAndToolbar.selectionToolbar.display.disabledSites.enterUrlPattern",
          )}
          tableHeaderText={i18n.t(
            "options.floatingButtonAndToolbar.selectionToolbar.display.disabledSites.urlPattern",
          )}
        />
      </ConfigItem>
    </ConfigSection>
  )
}

/**
 * Dragging is continuous but the config write is not, so the thumb follows a local draft and
 * only the released value is stored. The width is fixed: a slider that stretched with the
 * control column would read a different percentage per point at every window size.
 */
function OpacitySlider({
  value,
  onValueCommitted,
}: {
  value: number
  onValueCommitted: (value: number) => void
}) {
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    setDraft(value)
  }, [value])

  return (
    <div className="flex w-56 items-center gap-3">
      <Slider
        min={MIN_SELECTION_OVERLAY_OPACITY}
        max={MAX_SELECTION_OVERLAY_OPACITY}
        step={1}
        value={draft}
        onValueChange={(next) => {
          setDraft(next as number)
        }}
        onValueCommitted={(next) => {
          onValueCommitted(next as number)
        }}
        className="flex-1"
      />
      <span className="w-10 shrink-0 text-right text-sm tabular-nums">{draft}%</span>
    </div>
  )
}
