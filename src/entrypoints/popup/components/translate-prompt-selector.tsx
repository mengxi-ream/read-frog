import { i18n } from "#imports"
import { useAtom, useAtomValue } from "jotai"
import { HelpTooltip } from "@/components/help-tooltip"
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
import { featureProviderConfigAtom } from "@/utils/atoms/provider"
import { DEFAULT_TRANSLATE_PROMPT_ID } from "@/utils/constants/prompt"

export default function TranslatePromptSelector() {
  const translateProviderConfig = useAtomValue(featureProviderConfigAtom("translate"))
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  if (!translateProviderConfig?.provider || !isLLMProvider(translateProviderConfig?.provider))
    return null

  const customPromptsConfig = translateConfig.customPromptsConfig
  const { patterns = [], promptId } = customPromptsConfig

  const items = [
    { value: DEFAULT_TRANSLATE_PROMPT_ID, label: i18n.t("options.translation.personalizedPrompts.default") },
    ...patterns.map(prompt => ({ value: prompt.id, label: prompt.name })),
  ]

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] font-medium flex items-center gap-1.5">
        {i18n.t("translatePrompt.title")}
        <HelpTooltip>
          {i18n.t("translatePrompt.description")}
        </HelpTooltip>
      </span>
      <Select
        items={items}
        value={promptId ?? DEFAULT_TRANSLATE_PROMPT_ID}
        onValueChange={(value) => {
          void setTranslateConfig({
            customPromptsConfig: {
              ...customPromptsConfig,
              promptId: value === DEFAULT_TRANSLATE_PROMPT_ID ? null : value,
            },
          })
        }}
      >
        <SelectTrigger className="h-7! w-31 pr-1.5 pl-2.5">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map(item => (
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
