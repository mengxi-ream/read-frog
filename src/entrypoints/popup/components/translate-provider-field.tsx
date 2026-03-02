import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import { useMemo } from "react"
import { HelpTooltip } from "@/components/help-tooltip"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { isTranslateProvider } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"

export default function TranslateProviderField() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const providers = useMemo(() => {
    const exclude = translateConfig.mode === "translationOnly" ? ["google-translate"] : undefined
    return filterEnabledProvidersConfig(providersConfig)
      .filter(p => isTranslateProvider(p.provider))
      .filter(p => !exclude?.includes(p.provider))
  }, [providersConfig, translateConfig.mode])

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t("translateService.title")}
        <HelpTooltip>
          {i18n.t("translateService.description")}
        </HelpTooltip>
      </span>
      <ProviderSelector
        providers={providers}
        value={translateConfig.providerId}
        onChange={id => void setTranslateConfig({ providerId: id })}
        className="h-7! w-31 cursor-pointer pr-1.5 pl-2.5"
      />
    </div>
  )
}
