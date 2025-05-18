import type { TranslateProviderNames } from '@/types/config/provider'
import deepmerge from 'deepmerge'
import { useAtom } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { translateProviderModels } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { LLM_TRANSLATE_PROVIDER_ITEMS, PURE_TRANSLATE_PROVIDER_ITEMS } from '@/utils/constants/config'

export default function ReadProvider() {
  return (
    <div>
      <h3 className="text-md font-semibold mb-2">Read Provider</h3>
      <div className="flex gap-8">
        <TranslateProviderSelector />
        <TranslateModelSelector />
      </div>
    </div>
  )
}

function TranslateProviderSelector() {
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)
  return (
    <div className="flex flex-col w-[220px] gap-1.5">
      <label className="text-sm font-medium">
        Provider
      </label>
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
    </div>
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
    <div className="flex flex-col w-[280px] gap-1.5">
      <label htmlFor="model" className="text-sm font-medium">
        LLM Model
      </label>
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
      <div className="mt-2 flex items-center space-x-2">
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
    </div>
  )
}
