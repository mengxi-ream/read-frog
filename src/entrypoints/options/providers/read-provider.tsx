import type { ReadProviderNames } from '@/types/config/provider'
import deepmerge from 'deepmerge'
import { useAtom } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { readProviderModels } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { READ_PROVIDER_ITEMS } from '@/utils/constants/config'

export default function ReadProvider() {
  return (
    <div>
      <h3 className="text-md font-semibold mb-2">Read Provider</h3>
      <div className="flex gap-8">
        <ReadProviderSelector />
        <ReadModelSelector />
      </div>
    </div>
  )
}

function ReadProviderSelector() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  return (
    <div className="flex flex-col w-[220px] gap-1.5">
      <label className="text-sm font-medium">
        Provider
      </label>
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
    </div>
  )
}

function ReadModelSelector() {
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  const modelConfig = readConfig.models[readConfig.provider]
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
      <div className="mt-2 flex items-center space-x-2">
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
    </div>
  )
}
