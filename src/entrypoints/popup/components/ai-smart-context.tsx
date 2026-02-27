import { i18n } from "#imports"
import { deepmerge } from "deepmerge-ts"
import { useAtom } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import { Switch } from "@/components/ui/base-ui/switch"
import { configFieldsAtomMap } from "@/utils/atoms/config"

export function AISmartContext() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        {i18n.t("popup.aiSmartContext")}
        <HelpTooltip>
          {i18n.t("popup.aiSmartContextDescription")}
        </HelpTooltip>
      </span>
      <Switch
        checked={translateConfig.enableAIContentAware}
        onCheckedChange={checked =>
          setTranslateConfig(deepmerge(translateConfig, { enableAIContentAware: checked }))}
      />
    </div>
  )
}
