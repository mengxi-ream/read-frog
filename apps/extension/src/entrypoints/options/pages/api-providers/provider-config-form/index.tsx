import { cn } from '@repo/ui/lib/utils'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import { isAPIProviderConfig } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { providerConfigAtom } from '@/utils/atoms/provider'
import { selectedProviderIdAtom } from '../atoms'
import { APIKeyField } from './api-key-field'
import { formOpts, useAppForm } from './form'

export function ProviderConfigForm() {
  const selectedProviderId = useAtomValue(selectedProviderIdAtom)
  const [providerConfig, setProviderConfig] = useAtom(providerConfigAtom(selectedProviderId ?? ''))
  const allProviders = useAtomValue(configFields.providersConfig)

  const specificFormOpts = {
    ...formOpts,
    defaultValues: providerConfig && isAPIProviderConfig(providerConfig) ? providerConfig : undefined,
  }

  const form = useAppForm({
    ...specificFormOpts,
    onSubmit: async ({ value }) => {
      void setProviderConfig(value)
    },
  })

  // Reset form when selectedProviderId changes
  useEffect(() => {
    if (providerConfig && isAPIProviderConfig(providerConfig)) {
      form.reset(providerConfig)
    }
  }, [providerConfig, form])

  if (!providerConfig || !isAPIProviderConfig(providerConfig)) {
    return null
  }

  return (
    <form.AppForm
      // onSubmit={(e) => {
      //   e.preventDefault()
      //   e.stopPropagation()
      //   void form.handleSubmit()
      // }}
    >
      <div className={cn('flex-1 bg-card rounded-xl p-4 border flex flex-col gap-4', selectedProviderId !== providerConfig.id && 'hidden')}>
        <form.AppField
          name="name"
          validators={{
            onChange: ({ value }) => {
              const duplicateProvider = allProviders.find(provider =>
                provider.name === value && provider.id !== providerConfig.id,
              )
              if (duplicateProvider) {
                return `Custom: Duplicate provider name "${value}"`
              }
              return undefined
            },
          }}
        >
          {field => <field.InputField formForSubmit={form} label="Name" />}
        </form.AppField>
        <form.AppField name="description">
          {field => <field.InputField formForSubmit={form} label="Description" />}
        </form.AppField>

        <APIKeyField form={form} />
        <form.AppField name="baseURL">
          {field => <field.InputField formForSubmit={form} label="Base URL" value={providerConfig.baseURL ?? ''} />}
        </form.AppField>
      </div>
    </form.AppForm>
  )
}
