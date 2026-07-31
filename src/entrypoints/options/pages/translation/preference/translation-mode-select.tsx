import type { TranslationMode } from "@/types/config/translate"
import { useAtom } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { TRANSLATION_MODES } from "@/types/config/translate"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** Bare translation-mode control. Callers own the surrounding label and layout. */
export function TranslationModeSelect() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const { mode } = translateConfig

  return (
    <Select
      value={mode}
      onValueChange={(nextMode: TranslationMode | null) => {
        if (!nextMode) return
        void setTranslateConfig({ mode: nextMode })
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue render={<span />}>
          {i18n.t(`options.translation.translationMode.mode.${mode}`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          {TRANSLATION_MODES.map((item) => (
            <SelectItem key={item} value={item}>
              {i18n.t(`options.translation.translationMode.mode.${item}`)}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
