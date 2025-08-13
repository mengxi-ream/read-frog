import type { ReadProviderNames } from '@/types/config/provider'
import { i18n } from '#imports'
import { Checkbox } from '@repo/ui/components/checkbox'
import { Input } from '@repo/ui/components/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import deepmerge from 'deepmerge'
import { useAtom, useAtomValue } from 'jotai'
import ProviderIcon from '@/components/provider-icon'
import { READ_PROVIDER_MODELS } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { READ_PROVIDER_ITEMS } from '@/utils/constants/config'
import { ConfigCard } from '../../components/config-card'
import { FieldWithLabel } from '../../components/field-with-label'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

export function ReadConfig() {
  return (
    <ConfigCard title={i18n.t('options.general.readConfig.title')} description={i18n.t('options.general.readConfig.description')}>
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
          {i18n.t('options.general.readConfig.provider')}
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
    <FieldWithLabel id="readModel" label={i18n.t('options.general.readConfig.model.title')}>
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
                  {READ_PROVIDER_MODELS[readConfig.provider].map(model => (
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
          id={`isCustomModel-read-${readConfig.provider}`}
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
          htmlFor={`isCustomModel-read-${readConfig.provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          {i18n.t('options.general.readConfig.model.enterCustomModel')}
        </label>
      </div>
    </FieldWithLabel>
  )
}
