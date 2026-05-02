import type { TranslationMode as TranslationModeType } from "@/types/config/translate"
import { i18n } from "#imports"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
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

export default function TranslationModeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const currentMode = translateConfig.mode

  const handleModeChange = (mode: TranslationModeType | null) => {
    if (!mode)
      return

    void setTranslateConfig(
      deepmerge(translateConfig, { mode }),
    )
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t("options.translation.translationMode.title")}
        <HelpTooltip>
          {i18n.t("options.translation.translationMode.description")}
        </HelpTooltip>
      </span>
      <Select
        value={currentMode}
        onValueChange={handleModeChange}
      >
        <SelectTrigger className="h-7! w-31">
          <SelectValue>
            {i18n.t(`options.translation.translationMode.mode.${currentMode}`)}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {TRANSLATION_MODES.map(mode => (
              <SelectItem key={mode} value={mode}>
                {i18n.t(`options.translation.translationMode.mode.${mode}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
