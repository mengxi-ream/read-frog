import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'
import TranslateProviderSelector from '@/components/llm-providers/translate-provider-selector'
// TODO: use base-ui/checkbox has the bug Maximum update depth, report to base-ui
import { Checkbox } from '@/components/ui/base-ui/checkbox'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { Input } from '@/components/ui/base-ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/base-ui/select'
import { isAPIProviderConfig, isLLMTranslateProviderConfig, TRANSLATE_PROVIDER_MODELS } from '@/types/config/provider'
import { translateProviderConfigAtom, updateLLMProviderConfig } from '@/utils/atoms/provider'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'
import { RangeSelector } from './components/range-selector'

export default function TranslationConfig() {
  return (
    <ConfigCard title={i18n.t('options.general.translationConfig.title')} description={i18n.t('options.general.translationConfig.description')}>
      <div className="space-y-4">
        <TranslateProviderSelectorField />
        <TranslateModelSelector />
        <RangeSelector />
      </div>
    </ConfigCard>
  )
}

function TranslateProviderSelectorField() {
  const translateProviderConfig = useAtomValue(translateProviderConfigAtom)

  // some deeplx providers don't need api key
  const needSetAPIKey = translateProviderConfig && isAPIProviderConfig(translateProviderConfig) && translateProviderConfig.provider !== 'deeplx' && !translateProviderConfig.apiKey

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.translationConfig.provider')}
        {needSetAPIKey && <SetApiKeyWarning />}
      </FieldLabel>
      <TranslateProviderSelector className="w-full" />
    </Field>
  )
}

function TranslateModelSelector() {
  const [translateProviderConfig, setTranslateProviderConfig] = useAtom(translateProviderConfigAtom)

  if (!translateProviderConfig || !isLLMTranslateProviderConfig(translateProviderConfig)) {
    return null
  }

  const provider = translateProviderConfig.provider
  const modelConfig = translateProviderConfig.models.translate

  return (
    <>
      <Field>
        <FieldLabel nativeLabel={false} render={<div />}>
          {i18n.t('options.general.translationConfig.model.title')}
        </FieldLabel>
        {modelConfig.isCustomModel
          ? (
              <Input
                value={modelConfig.customModel ?? ''}
                onChange={(e) => {
                  void setTranslateProviderConfig(
                    updateLLMProviderConfig(translateProviderConfig, {
                      models: {
                        translate: {
                          customModel: e.target.value === '' ? null : e.target.value,
                        },
                      },
                    }),
                  )
                }}
              />
            )
          : (
              <Select
                value={modelConfig.model}
                onValueChange={(value) => {
                  if (!value)
                    return
                  void setTranslateProviderConfig(
                    updateLLMProviderConfig(translateProviderConfig, {
                      models: {
                        translate: {
                          model: value as any,
                        },
                      },
                    }),
                  )
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TRANSLATE_PROVIDER_MODELS[provider].map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
      </Field>
      {provider !== 'openai-compatible' && (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={`isCustomModel-translate-${provider}`}
            checked={modelConfig.isCustomModel}
            onCheckedChange={(checked: boolean) => {
              try {
                if (checked === false) {
                  void setTranslateProviderConfig(
                    updateLLMProviderConfig(translateProviderConfig, {
                      models: {
                        translate: {
                          customModel: null,
                          isCustomModel: false,
                        },
                      },
                    }),
                  )
                }
                else if (checked === true) {
                  void setTranslateProviderConfig(
                    updateLLMProviderConfig(translateProviderConfig, {
                      models: {
                        translate: {
                          customModel: modelConfig.model,
                          isCustomModel: true,
                        },
                      },
                    }),
                  )
                }
              }
              catch (error) {
                toast.error(error instanceof Error ? error.message : 'Failed to update configuration')
              }
            }}
          />
          <label
            htmlFor={`isCustomModel-translate-${provider}`}
            className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            {i18n.t('options.general.translationConfig.model.enterCustomModel')}
          </label>
        </div>
      )}
    </>
  )
}
