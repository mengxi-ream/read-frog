import type { ReactNode } from "react"
import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import { Input } from "@/components/ui/base-ui/input"
import { Label } from "@/components/ui/base-ui/label"
import { toastManager } from "@/components/ui/base-ui/toast"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import {
  MAX_CHARACTERS_PER_NODE,
  MAX_WORDS_PER_NODE,
  MIN_CHARACTERS_PER_NODE,
  MIN_WORDS_PER_NODE,
} from "@/utils/constants/translate"
import { i18n } from "@/utils/i18n"
import { ConfigItem } from "../../../components/config-item"

export function SmallParagraphFilterItem() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { minCharactersPerNode, minWordsPerNode } = translateConfig.page

  return (
    <ConfigItem
      id="small-paragraph-filter"
      title={i18n.t("options.translation.smallParagraphFilter.title")}
      description={i18n.t("options.translation.smallParagraphFilter.description")}
    >
      <div className="flex flex-col items-end gap-3">
        <ThresholdField
          id="min-characters-per-node"
          label={i18n.t("options.translation.smallParagraphFilter.minCharacters.title")}
          tooltip={i18n.t("options.translation.smallParagraphFilter.minCharacters.description")}
          value={minCharactersPerNode}
          min={MIN_CHARACTERS_PER_NODE}
          max={MAX_CHARACTERS_PER_NODE}
          onValue={(minCharacters) => {
            void setTranslateConfig({
              page: { ...translateConfig.page, minCharactersPerNode: minCharacters },
            })
          }}
        />
        <ThresholdField
          id="min-words-per-node"
          label={i18n.t("options.translation.smallParagraphFilter.minWords.title")}
          tooltip={i18n.t("options.translation.smallParagraphFilter.minWords.description")}
          value={minWordsPerNode}
          min={MIN_WORDS_PER_NODE}
          max={MAX_WORDS_PER_NODE}
          onValue={(minWords) => {
            void setTranslateConfig({
              page: { ...translateConfig.page, minWordsPerNode: minWords },
            })
          }}
        />
      </div>
    </ConfigItem>
  )
}

/** One threshold. Out-of-range input is reported and dropped, so the config keeps its last good value. */
function ThresholdField({
  id,
  label,
  tooltip,
  value,
  min,
  max,
  onValue,
}: {
  id: string
  label: ReactNode
  tooltip: ReactNode
  value: number
  min: number
  max: number
  onValue: (value: number) => void
}) {
  return (
    <div className="flex items-center gap-3">
      <Label htmlFor={id}>
        {label}
        <HelpTooltip>{tooltip}</HelpTooltip>
      </Label>
      <Input
        id={id}
        className="w-24 shrink-0"
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => {
          const nextValue = Number(e.target.value)
          if (nextValue >= min && nextValue <= max) {
            onValue(nextValue)
            return
          }
          toastManager.add({
            type: "error",
            title: i18n.t("options.translation.smallParagraphFilter.error", [min, max]),
          })
        }}
      />
    </div>
  )
}
