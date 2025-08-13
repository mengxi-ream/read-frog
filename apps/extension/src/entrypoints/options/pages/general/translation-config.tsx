import type { PageTranslateRange, TranslateProviderNames } from '@/types/config/provider'
import { i18n } from '#imports'

import { Checkbox } from '@repo/ui/components/checkbox'
import { Input } from '@repo/ui/components/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/select'
import deepmerge from 'deepmerge'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { isAPIProvider, isLLMTranslateProvider, pageTranslateRangeSchema, TRANSLATE_PROVIDER_MODELS } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { LLM_TRANSLATE_PROVIDER_ITEMS, PURE_TRANSLATE_PROVIDER_ITEMS } from '@/utils/constants/config'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

export default function TranslationConfig() {
  return (
    <ConfigCard title={i18n.t('options.general.translationConfig.title')} description={i18n.t('options.general.translationConfig.description')}>
      <div className="space-y-4">
        <TranslateProviderSelector />
        <TranslateModelSelector />
        <RangeSelector />
      </div>
    </ConfigCard>
  )
}

function RangeSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  return (
    <FieldWithLabel id="translateRange" label={i18n.t('options.general.translationConfig.translateRange.title')}>
      <Select
        value={translateConfig.page.range}
        onValueChange={(value: PageTranslateRange) =>
          setTranslateConfig(
            deepmerge(translateConfig, { page: { range: value } }),
          )}
      >
        <SelectTrigger className="w-full">
          <SelectValue asChild>
            <span>
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
    </FieldWithLabel>
  )
}

function TranslateProviderSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  const providersConfig = useAtomValue(configFields.providersConfig)

  const providerConfig = isAPIProvider(translateConfig.provider)
    ? providersConfig[translateConfig.provider]
    : null

  return (
    <FieldWithLabel
      id="translateProvider"
      label={(
        <div className="flex gap-2">
          {i18n.t('options.general.translationConfig.provider')}
          {providerConfig && !providerConfig.apiKey && translateConfig.provider !== 'deeplx' && <SetApiKeyWarning />}
        </div>
      )}
    >
      <Select
        value={translateConfig.provider}
        onValueChange={(value: TranslateProviderNames) =>
          setTranslateConfig(
            { ...translateConfig, provider: value },
          )}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>{i18n.t('translateService.aiTranslator')}</SelectLabel>
            {Object.entries(LLM_TRANSLATE_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
              <SelectItem key={value} value={value}>
                <ProviderIcon logo={logo} name={name} />
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>{i18n.t('translateService.normalTranslator')}</SelectLabel>
            {Object.entries(PURE_TRANSLATE_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
              <SelectItem key={value} value={value}>
                <ProviderIcon logo={logo} name={name} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FieldWithLabel>
  )
}

function TranslateModelSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)

  const provider = translateConfig.provider

  if (!isLLMTranslateProvider(provider)) {
    return null
  }

  const modelConfig = translateConfig.models[provider]

  return (
    <FieldWithLabel id="translateModel" label={i18n.t('options.general.translationConfig.model.title')}>
      {modelConfig.isCustomModel
        ? (
            <Input
              value={modelConfig.customModel}
              onChange={e =>
                setTranslateConfig(deepmerge(translateConfig, {
                  models: {
                    [provider]: {
                      customModel: e.target.value,
                    },
                  },
                }))}
            />
          )
        : (
            <Select
              value={modelConfig.model}
              onValueChange={value =>
                setTranslateConfig(deepmerge(translateConfig, {
                  models: {
                    [provider]: {
                      model: value,
                    },
                  },
                }))}
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
      <div className="mt-0.5 flex items-center space-x-2">
        <Checkbox
          id={`isCustomModel-translate-${translateConfig.provider}`}
          checked={modelConfig.isCustomModel}
          onCheckedChange={(checked) => {
            if (checked === false) {
              setTranslateConfig(deepmerge(translateConfig, {
                models: {
                  [translateConfig.provider]: {
                    customModel: '',
                    isCustomModel: false,
                  },
                },
              }))
            }
            else {
              setTranslateConfig(deepmerge(translateConfig, {
                models: {
                  [translateConfig.provider]: {
                    customModel: translateConfig.models[provider].model,
                    isCustomModel: true,
                  },
                },
              }))
            }
          }}
        />
        <label
          htmlFor={`isCustomModel-translate-${translateConfig.provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          {i18n.t('options.general.translationConfig.model.enterCustomModel')}
        </label>
      </div>
    </FieldWithLabel>
  )
}
