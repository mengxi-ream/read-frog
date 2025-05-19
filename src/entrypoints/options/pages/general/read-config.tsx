import type { ReadProviderNames } from '@/types/config/provider'
import deepmerge from 'deepmerge'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { readProviderModels } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { READ_PROVIDER_ITEMS } from '@/utils/constants/config'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

export function ReadConfig() {
  return (
    <ConfigCard title="Read Config" description="For all advanced AI functions, such as in-depth article explanations and keyword extraction.">
      <div className="flex flex-col gap-4">
        <ReadProviderSelector />
        <ReadModelSelector />
      </div>
    </ConfigCard>
  )
}

function ReadProviderSelector() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  const providersConfig = useAtomValue(configFields.providersConfig)
  const providerConfig = providersConfig[readConfig.provider]
  return (
    <FieldWithLabel
      id="readProvider"
      label={(
        <div className="flex gap-2">
          Provider
          {!providerConfig.apiKey && <SetApiKeyWarning />}
        </div>
      )}
    >
      <Select
        value={readConfig.provider}
        onValueChange={(value: ReadProviderNames) =>
          setReadConfig(
            { ...readConfig, provider: value },
          )}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(READ_PROVIDER_ITEMS).map(([value, { logo, name }]) => (
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

function ReadModelSelector() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  const modelConfig = readConfig.models[readConfig.provider]
  return (
    <FieldWithLabel id="readModel" label="LLM Model">
      {modelConfig.isCustomModel
        ? (
            <Input
              value={modelConfig.customModel}
              onChange={e =>
                setReadConfig(deepmerge(readConfig, {
                  models: {
                    [readConfig.provider]: {
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
                setReadConfig(deepmerge(readConfig, {
                  models: {
                    [readConfig.provider]: {
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
                  {readProviderModels[readConfig.provider].map(model => (
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
          id={`isCustomModel-${readConfig.provider}`}
          checked={modelConfig.isCustomModel}
          onCheckedChange={(checked) => {
            if (checked === false) {
              setReadConfig(deepmerge(readConfig, {
                models: {
                  [readConfig.provider]: {
                    customModel: '',
                    isCustomModel: false,
                  },
                },
              }))
            }
            else {
              setReadConfig(deepmerge(readConfig, {
                models: {
                  [readConfig.provider]: {
                    customModel: readConfig.models[readConfig.provider].model,
                    isCustomModel: true,
                  },
                },
              }))
            }
          }}
        />
        <label
          htmlFor={`isCustomModel-${readConfig.provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {i18n.t('options.providerConfig.model.enterCustomModel')}
        </label>
      </div>
    </FieldWithLabel>
  )
}
