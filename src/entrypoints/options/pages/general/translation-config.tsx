import type { PageTranslateRange } from '@/types/config/translate'
import { i18n } from '#imports'
import { deepmerge } from 'deepmerge-ts'
import { useAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'
import TranslateProviderSelector from '@/components/llm-providers/translate-provider-selector'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Field, FieldLabel } from '@/components/shadcn/field'
import { Input } from '@/components/shadcn/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { isAPIProviderConfig, isLLMTranslateProviderConfig, TRANSLATE_PROVIDER_MODELS } from '@/types/config/provider'
import { pageTranslateRangeSchema } from '@/types/config/translate'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { translateProviderConfigAtom, updateLLMProviderConfig } from '@/utils/atoms/provider'
import { cn } from '@/utils/styles/utils'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

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

function RangeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  return (
    <Field>
      <FieldLabel htmlFor="translateRange">
        {i18n.t('options.general.translationConfig.translateRange.title')}
      </FieldLabel>
      <Select
        value={translateConfig.page.range}
        onValueChange={(value: PageTranslateRange) =>
          setTranslateConfig(
            deepmerge(translateConfig, { page: { range: value } }),
          )}
      >
        <SelectTrigger className="w-full">
          <SelectValue asChild>
            <span id="translateRange">
              {i18n.t(
                `options.general.translationConfig.translateRange.range.${translateConfig.page.range}`,
              )}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {pageTranslateRangeSchema.options.map(range => (
              <SelectItem key={range} value={range}>
                {i18n.t(
                  `options.general.translationConfig.translateRange.range.${range}`,
                )}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

function TranslateProviderSelectorField() {
  const translateProviderConfig = useAtomValue(translateProviderConfigAtom)

  // some deeplx providers don't need api key
  const needSetAPIKey = translateProviderConfig && isAPIProviderConfig(translateProviderConfig) && translateProviderConfig.provider !== 'deeplx' && !translateProviderConfig.apiKey

  return (
    <Field>
      <FieldLabel htmlFor="translateProvider">
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
    <Field>
      <FieldLabel htmlFor="translateModel">
        {i18n.t('options.general.translationConfig.model.title')}
      </FieldLabel>
      {modelConfig.isCustomModel
        ? (
            <Input
              value={modelConfig.customModel ?? ''}
              onChange={(e) => {
                try {
                  void setTranslateProviderConfig(
                    updateLLMProviderConfig(translateProviderConfig, {
                      models: {
                        translate: {
                          customModel: e.target.value === '' ? null : e.target.value,
                        },
                      },
                    }),
                  )
                }
                catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to update configuration')
                }
              }}
            />
          )
        : (
            <Select
              value={modelConfig.model}
              onValueChange={(value) => {
                try {
                  void setTranslateProviderConfig(
                    updateLLMProviderConfig(translateProviderConfig, {
                      models: {
                        translate: {
                          model: value as any,
                        },
                      },
                    }),
                  )
                }
                catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to update configuration')
                }
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
      <div className={cn('mt-0.5 flex items-center space-x-2', provider === 'openai-compatible' && 'hidden')}>
        <Checkbox
          id={`isCustomModel-translate-${provider}`}
          checked={modelConfig.isCustomModel}
          onCheckedChange={(checked) => {
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
    </Field>
  )
}
