import { i18n } from "#imports"
import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export default function TranslateProviderField() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t("translateService.title")}
        <HelpTooltip>
          {i18n.t("translateService.description")}
        </HelpTooltip>
      </span>
      <ProviderSelector
        featureKey="translate"
        value={translateConfig.providerId}
        onChange={id => void setTranslateConfig({ providerId: id })}
        excludeProviderTypes={translateConfig.mode === "translationOnly" ? ["google-translate"] : undefined}
        className="h-7! w-31 cursor-pointer pr-1.5 pl-2.5"
      />
    </div>
  )
}
