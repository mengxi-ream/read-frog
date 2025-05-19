import type { PageTranslateRange, TranslateProviderNames } from '@/types/config/provider'
import deepmerge from 'deepmerge'

import { useAtom } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { pageTranslateRangeSchema, translateProviderModels } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { LLM_TRANSLATE_PROVIDER_ITEMS, PURE_TRANSLATE_PROVIDER_ITEMS } from '@/utils/constants/config'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'

export default function TranslationConfig() {
  return (
    <ConfigCard title="Translation Config" description="Only for translation within web pages, such as bilingual paragraph translation.">
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
    <FieldWithLabel label={i18n.t('options.translationConfig.translateRange.title')}>
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
                `options.translationConfig.translateRange.range.${translateConfig.page.range}`,
              )}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {pageTranslateRangeSchema.options.map(range => (
              <SelectItem key={range} value={range}>
                {i18n.t(
                  `options.translationConfig.translateRange.range.${range}`,
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
  return (
    <FieldWithLabel label="Provider">
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
  const modelConfig = translateConfig.models[translateConfig.provider]

  if (!modelConfig) {
    return null
  }

  const provider = translateConfig.provider as keyof typeof translateProviderModels

  return (
    <FieldWithLabel label="LLM Model">
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
                  {translateProviderModels[provider].map(model => (
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
          id={`isCustomModel-${translateConfig.provider}`}
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
          htmlFor={`isCustomModel-${translateConfig.provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {i18n.t('options.providerConfig.model.enterCustomModel')}
        </label>
      </div>
    </FieldWithLabel>
  )
}
