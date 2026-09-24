import { useAtom, useAtomValue } from "jotai"
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
import { DEFAULT_TRANSLATE_PROMPT_ID } from "@/utils/constants/prompt"
import { i18n } from "@/utils/i18n"
import { selectedProvidersAtom } from "../atoms"
import { getHubPromptConfig } from "../prompt"

export function PromptSelector() {
  const selectedProviders = useAtomValue(selectedProvidersAtom)
  const [hubConfig, setHubConfig] = useAtom(configFieldsAtomMap.translationHub)
  const translateConfig = useAtomValue(configFieldsAtomMap.pageTranslation)

  // Only show when at least one LLM provider is selected
  const hasLLMProvider = selectedProviders.some(
    (provider) => provider.kind === "system" || isLLMProvider(provider.config.provider),
  )
  if (!hasLLMProvider) return null

  const { patterns, promptId } = getHubPromptConfig(
    hubConfig.promptId ??
      translateConfig.customPromptsConfig.promptId ??
      DEFAULT_TRANSLATE_PROMPT_ID,
    translateConfig.customPromptsConfig,
  )
  const items = getPageTranslatePromptSelectItems(patterns)
  const selectedItem = items.find(({ value }) => value === promptId) ?? items[0]

  return (
    <Select
      items={items}
      value={promptId ?? DEFAULT_TRANSLATE_PROMPT_ID}
      onValueChange={(value) => {
        void setHubConfig({ promptId: value ?? DEFAULT_TRANSLATE_PROMPT_ID })
      }}
    >
      <SelectTrigger className="w-36">
        <SelectValue placeholder={i18n.t("translatePrompt.title")}>
          <span className="truncate">
            {selectedItem?.label ?? i18n.t("options.translation.personalizedPrompts.default")}
          </span>
        </SelectValue>
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
  )
}
