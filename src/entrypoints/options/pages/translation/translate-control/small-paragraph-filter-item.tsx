import type { ReactNode } from "react"
import { useAtom } from "jotai"
import { Input } from "@/components/ui/base-ui/input"
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

/**
 * Two thresholds, a row each. The word count hangs off the character count's title, so both
 * rows can say in full what they measure instead of hiding it behind a tooltip.
 */
export function SmallParagraphFilterItem() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { minCharactersPerNode, minWordsPerNode } = translateConfig.page

  return (
    <>
      <ConfigItem
        id="small-paragraph-filter"
        title={i18n.t("options.translation.smallParagraphFilter.title")}
        description={i18n.t("options.translation.smallParagraphFilter.minCharacters.description")}
      >
        <ThresholdInput
          value={minCharactersPerNode}
          min={MIN_CHARACTERS_PER_NODE}
          max={MAX_CHARACTERS_PER_NODE}
          onValue={(minCharacters) => {
            void setTranslateConfig({
              page: { ...translateConfig.page, minCharactersPerNode: minCharacters },
            })
          }}
        />
      </ConfigItem>
      <ConfigItem
        description={i18n.t("options.translation.smallParagraphFilter.minWords.description")}
      >
        <ThresholdInput
          value={minWordsPerNode}
          min={MIN_WORDS_PER_NODE}
          max={MAX_WORDS_PER_NODE}
          onValue={(minWords) => {
            void setTranslateConfig({
              page: { ...translateConfig.page, minWordsPerNode: minWords },
            })
          }}
        />
      </ConfigItem>
    </>
  )
}

/** Out-of-range input is reported and dropped, so the config keeps its last good value. */
function ThresholdInput({
  value,
  min,
  max,
  onValue,
}: {
  value: number
  min: number
  max: number
  onValue: (value: number) => void
}): ReactNode {
  return (
    <Input
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
  )
}
