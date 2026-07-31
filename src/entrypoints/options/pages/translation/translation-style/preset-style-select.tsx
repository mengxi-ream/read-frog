import type { TranslationNodeStylePreset } from "@/types/config/translate"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { TRANSLATION_NODE_STYLE } from "@/utils/constants/translation-node-style"
import { i18n } from "@/utils/i18n"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** Bare preset-style control. Callers own the surrounding label and layout. */
export function PresetStyleSelect() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { translationNodeStyle } = translateConfig

  return (
    <Select
      value={translationNodeStyle.preset}
      onValueChange={(preset: TranslationNodeStylePreset | null) => {
        if (!preset) return
        void setTranslateConfig({ translationNodeStyle: { ...translationNodeStyle, preset } })
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue render={<span />}>
          {i18n.t(`options.translation.translationStyle.style.${translationNodeStyle.preset}`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          {TRANSLATION_NODE_STYLE.map((nodeStyle) => (
            <SelectItem key={nodeStyle} value={nodeStyle}>
              {i18n.t(`options.translation.translationStyle.style.${nodeStyle}`)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
