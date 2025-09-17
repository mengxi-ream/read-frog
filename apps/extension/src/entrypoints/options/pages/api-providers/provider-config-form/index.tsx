import { i18n } from '#imports'
import { Button } from '@repo/ui/components/button'
import { cn } from '@repo/ui/lib/utils'
import { useAtom } from 'jotai'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { isAPIProviderConfig } from '@/types/config/provider'
import { configFields } from '@/utils/atoms/config'
import { providerConfigAtom } from '@/utils/atoms/provider'
import { getAPIProvidersConfig } from '@/utils/config/helpers'
import { selectedProviderIdAtom } from '../atoms'
import { APIKeyField } from './api-key-field'
import { formOpts, useAppForm } from './form'

export function ProviderConfigForm() {
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const [providerConfig, setProviderConfig] = useAtom(providerConfigAtom(selectedProviderId ?? ''))
  const [allProvidersConfig, setAllProvidersConfig] = useAtom(configFields.providersConfig)
  const [readConfig, setReadConfig] = useAtom(configFields.read)
  const [translateConfig, setTranslateConfig] = useAtom(configFields.translate)

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

  const handleDelete = async () => {
    const updatedAllProviders = allProvidersConfig.filter(provider => provider.id !== providerConfig.id)
    const updatedAllAPIProviders = getAPIProvidersConfig(updatedAllProviders)
    if (updatedAllAPIProviders.length === 0) {
      toast.error(i18n.t('options.apiProviders.form.atLeastOneProvider'))
      return
    }

    if (readConfig.providerId === providerConfig.id) {
      void setReadConfig({ providerId: updatedAllAPIProviders[0].id })
    }
    if (translateConfig.providerId === providerConfig.id) {
      void setTranslateConfig({ providerId: updatedAllAPIProviders[0].id })
    }
    await setAllProvidersConfig(updatedAllProviders)
    setSelectedProviderId(updatedAllAPIProviders[0].id)
  }

  return (
    <form.AppForm
      // onSubmit={(e) => {
      //   e.preventDefault()
      //   e.stopPropagation()
      //   void form.handleSubmit()
      // }}
    >
      <div className={cn('flex-1 bg-card rounded-xl p-4 border flex flex-col justify-between', selectedProviderId !== providerConfig.id && 'hidden')}>
        <div className="flex flex-col gap-4">
          <form.AppField
            name="name"
            validators={{
              onChange: ({ value }) => {
                const duplicateProvider = allProvidersConfig.find(provider =>
                  provider.name === value && provider.id !== providerConfig.id,
                )
                if (duplicateProvider) {
                  return `Custom: Duplicate provider name "${value}"`
                }
                return undefined
              },
            }}
          >
            {field => <field.InputField formForSubmit={form} label={i18n.t('options.apiProviders.form.fields.name')} />}
          </form.AppField>
          <form.AppField name="description">
            {field => <field.InputField formForSubmit={form} label={i18n.t('options.apiProviders.form.fields.description')} />}
          </form.AppField>

          <APIKeyField form={form} />
          <form.AppField name="baseURL">
            {field => <field.InputField formForSubmit={form} label={i18n.t('options.apiProviders.form.fields.baseURL')} value={providerConfig.baseURL ?? ''} />}
          </form.AppField>
        </div>
        <div className="flex justify-end mt-8">
          <Button type="button" variant="destructive" onClick={handleDelete}>
            {i18n.t('options.apiProviders.form.delete')}
          </Button>
        </div>
      </div>
    </form.AppForm>
  )
}
