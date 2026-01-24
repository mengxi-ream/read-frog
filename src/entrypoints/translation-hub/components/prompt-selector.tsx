import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/base-ui/select'
import { isLLMTranslateProvider } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { DEFAULT_TRANSLATE_PROMPT_ID } from '@/utils/constants/prompt'
import { selectedProvidersAtom } from '../atoms'

export function PromptSelector() {
  const selectedProviders = useAtomValue(selectedProvidersAtom)
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)

  // Only show when at least one LLM provider is selected
  const hasLLMProvider = selectedProviders.some(p => isLLMTranslateProvider(p.provider))
  if (!hasLLMProvider)
    return null

  const { patterns = [], promptId } = translateConfig.customPromptsConfig

  return (
    <Select
      value={promptId ?? DEFAULT_TRANSLATE_PROMPT_ID}
      onValueChange={(value) => {
        void setTranslateConfig({
          customPromptsConfig: {
            ...translateConfig.customPromptsConfig,
            promptId: value === DEFAULT_TRANSLATE_PROMPT_ID ? null : value,
          },
        })
      }}
    >
      <SelectTrigger className="w-36">
        <SelectValue placeholder={i18n.t('translatePrompt.title')}>
          <span className="truncate">
            {promptId
              ? patterns.find(p => p.id === promptId)?.name ?? i18n.t('options.translation.personalizedPrompts.default')
              : i18n.t('options.translation.personalizedPrompts.default')}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem value={DEFAULT_TRANSLATE_PROMPT_ID}>
            {i18n.t('options.translation.personalizedPrompts.default')}
          </SelectItem>
          {patterns.map(prompt => (
            <SelectItem key={prompt.id} value={prompt.id}>
              {prompt.name}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
