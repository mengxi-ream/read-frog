import { useAtom, useAtomValue } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
import { getPageTranslatePromptSelectItems } from "@/components/prompt-configurator/built-in-prompts"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/base-ui/select"
import { isLLMProvider } from "@/types/config/provider"
import { configFieldsAtomMap } from "@/utils/atoms/config"
import { featureProviderRefAtom } from "@/utils/atoms/provider"
import { DEFAULT_TRANSLATE_PROMPT_ID } from "@/utils/constants/prompt"
import { i18n } from "@/utils/i18n"

export default function TranslatePromptSelector() {
  const translateProviderRef = useAtomValue(featureProviderRefAtom("pageTranslation"))
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.pageTranslation)

  if (
    !translateProviderRef ||
    (translateProviderRef.kind === "local" && !isLLMProvider(translateProviderRef.config.provider))
  )
    return null

  const customPromptsConfig = translateConfig.customPromptsConfig
  const { patterns, promptId } = customPromptsConfig

  const items = getPageTranslatePromptSelectItems(patterns)

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        {i18n.t("translatePrompt.title")}
        <HelpTooltip>{i18n.t("translatePrompt.description")}</HelpTooltip>
      </span>
      <Select
        items={items}
        value={promptId ?? DEFAULT_TRANSLATE_PROMPT_ID}
        onValueChange={(value) => {
          void setTranslateConfig({
            customPromptsConfig: {
              ...customPromptsConfig,
              promptId: value ?? DEFAULT_TRANSLATE_PROMPT_ID,
            },
          })
        }}
      >
        <SelectTrigger className="h-7! w-31 pr-1.5 pl-2.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}
