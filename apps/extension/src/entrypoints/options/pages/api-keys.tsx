import type { APIProviderNames } from '@/types/config/provider'
import { useAtom } from 'jotai'
import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { apiProviderNames } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { API_PROVIDER_ITEMS } from '@/utils/constants/config'
import { ConfigCard } from '../components/config-card'
import { FieldWithLabel } from '../components/field-with-label'
import { PageLayout } from '../components/page-layout'

export function ApiKeysPage() {
  return (
    <PageLayout title={i18n.t('options.apiKeys.title')} innerClassName="[&>*]:border-b [&>*:last-child]:border-b-0">
      {apiProviderNames.map(provider => (
        <ProviderConfigCard key={provider} provider={provider} />
      ))}
    </PageLayout>
  )
}

export function ProviderConfigCard({ provider }: { provider: APIProviderNames }) {
  const [providersConfig, setProvidersConfig] = useAtom(configFields.providersConfig)
  const [showAPIKey, setShowAPIKey] = useState(false)

  return (
    <ConfigCard
      title={(
        <div className="flex items-center gap-2">
          <img
            src={API_PROVIDER_ITEMS[provider].logo}
            alt={API_PROVIDER_ITEMS[provider].name}
            className="border-border size-5 p-[3px] rounded-full border bg-white"
          />
          {API_PROVIDER_ITEMS[provider].name}
        </div>
      )}
      description={i18n.t(`options.apiKeys.description.${provider}`)}
    >
      <div className="flex flex-col gap-y-4">
        <FieldWithLabel id={`${provider}-apiKey`} label="API Key">
          <Input
            className="mt-1 mb-2"
            value={providersConfig[provider].apiKey}
            type={showAPIKey ? 'text' : 'password'}
            onChange={e =>
              setProvidersConfig({
                ...providersConfig,
                [provider]: {
                  ...providersConfig[provider],
                  apiKey: e.target.value,
                },
              })}
          />
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`apiKey-${provider}`}
              checked={showAPIKey}
              onCheckedChange={checked => setShowAPIKey(checked === true)}
            />
            <label
              htmlFor={`apiKey-${provider}`}
              className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {i18n.t('options.apiKeys.apiKey.showAPIKey')}
            </label>
          </div>
        </FieldWithLabel>

        <AdvancedProviderConfig provider={provider} />
      </div>
    </ConfigCard>
  )
}

function AdvancedProviderConfig({ provider }: { provider: APIProviderNames }) {
  const [providersConfig, setProvidersConfig] = useAtom(configFields.providersConfig)
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <div>
      <button
        type="button"
        className={cn('text-sm font-medium text-blue-600 hover:underline', showAdvanced && 'mb-2')}
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        {showAdvanced ? i18n.t('options.apiKeys.advancedConfig.hide') : i18n.t('options.apiKeys.advancedConfig.show')}
      </button>

      {showAdvanced && (
        <FieldWithLabel id={`${provider}-baseURL`} label="Base URL">
          <Input
            className="mt-1 mb-2"
            value={providersConfig[provider].baseURL}
            onChange={e =>
              setProvidersConfig({
                ...providersConfig,
                [provider]: {
                  ...providersConfig[provider],
                  baseURL: e.target.value,
                },
              })}
          />
        </FieldWithLabel>
      )}
    </div>
  )
}
