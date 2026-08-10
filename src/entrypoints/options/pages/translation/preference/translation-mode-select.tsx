import type { TranslationMode } from "@/types/config/translate"
import { useAtom, useAtomValue } from "jotai"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { TRANSLATION_MODES } from "@/types/config/translate"
import { configAtom, configFieldsAtomMap } from "@/utils/atoms/config"
import { i18n } from "@/utils/i18n"
import { canEnterTranslationOnlyMode } from "@/utils/providers/translation-only-gate"
import { SELECT_CONTENT_PROPS } from "../../../components/select-content-props"

/** Bare translation-mode control. Callers own the surrounding label and layout. */
export function TranslationModeSelect() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)
  const config = useAtomValue(configAtom)
  const { mode } = translateConfig
  // translationOnly is unavailable while the page-translate provider has no
  // markup support (translation-only-gate.ts).
  const translationOnlyBlocked = !canEnterTranslationOnlyMode(config)

  return (
    <Select
      value={mode}
      onValueChange={(nextMode: TranslationMode | null) => {
        if (!nextMode) return
        if (nextMode === "translationOnly" && translationOnlyBlocked) return
        void setTranslateConfig({ mode: nextMode })
      }}
    >
      <SelectTrigger size="sm">
        <SelectValue render={<span />}>
          {i18n.t(`options.translation.preference.translationMode.mode.${mode}`)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent {...SELECT_CONTENT_PROPS}>
        <SelectGroup>
          {TRANSLATION_MODES.map((item) => {
            const disabled = item === "translationOnly" && translationOnlyBlocked
            return (
              <SelectItem
                key={item}
                value={item}
                disabled={disabled}
                title={
                  disabled
                    ? i18n.t("options.translation.preference.translationMode.microsoftNotSupported")
                    : undefined
                }
              >
                {i18n.t(`options.translation.preference.translationMode.mode.${item}`)}
              </SelectItem>
            )
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
