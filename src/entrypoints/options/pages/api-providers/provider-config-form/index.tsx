import type { ProvidersConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { useStore } from '@tanstack/react-form'
import { useAtom } from 'jotai'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/shadcn/button'
import { Separator } from '@/components/shadcn/separator'
import { isAPIProviderConfig, isLLMTranslateProvider, isNonAPIProvider, isReadProvider, isTranslateProvider } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { providerConfigAtom } from '@/utils/atoms/provider'
import { getReadProvidersConfig, getTranslateProvidersConfig, getTTSProvidersConfig } from '@/utils/config/helpers'
import { cn } from '@/utils/styles/tailwind'
import { selectedProviderIdAtom } from '../atoms'
import { APIKeyField } from './api-key-field'
import { BaseURLField } from './base-url-field'
import { AdvancedOptionsSection } from './components/advanced-options-section'
import { ConfigHeader } from './config-header'
import { DefaultReadProviderSelector, DefaultTranslateProviderSelector } from './default-provider'
import { formOpts, useAppForm } from './form'
import { ProviderOptionsField } from './provider-options-field'
import { ReadModelSelector } from './read-model-selector'
import { TemperatureField } from './temperature-field'
import { TranslateModelSelector } from './translate-model-selector'

export function ProviderConfigForm() {
  const [selectedProviderId, setSelectedProviderId] = useAtom(selectedProviderIdAtom)
  const [providerConfig, setProviderConfig] = useAtom(providerConfigAtom(selectedProviderId ?? ''))
  const [allProvidersConfig, setAllProvidersConfig] = useAtom(configFieldsAtomMap.providersConfig)
  const [readConfig, setReadConfig] = useAtom(configFieldsAtomMap.read)
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)

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

  const providerType = useStore(form.store, state => state.values.provider)
  const isReadProviderName = isReadProvider(providerType)
  const isTranslateProviderName = isTranslateProvider(providerType)
  const isLLMProvider = isLLMTranslateProvider(providerType)

  // Reset form when selectedProviderId changes
  useEffect(() => {
    if (providerConfig && isAPIProviderConfig(providerConfig)) {
      form.reset(providerConfig)
    }
  }, [providerConfig, form])

  if (!providerConfig || !isAPIProviderConfig(providerConfig)) {
    return null
  }

  const chooseNextProviderConfig = (providersConfig: ProvidersConfig) => {
    // better not choose non API provider
    const firstProvider = providersConfig.find(config => !isNonAPIProvider(config.provider))
    return firstProvider ?? providersConfig[0]
  }

  const handleDelete = async () => {
    const updatedAllProviders = allProvidersConfig.filter(provider => provider.id !== providerConfig.id)
    const updatedAllReadProviders = getReadProvidersConfig(updatedAllProviders)
    const updatedAllTranslateProviders = getTranslateProvidersConfig(updatedAllProviders)
    const updatedAllTTSProviders = getTTSProvidersConfig(updatedAllProviders)
    if (updatedAllReadProviders.length === 0 || updatedAllTranslateProviders.length === 0) {
      toast.error(i18n.t('options.apiProviders.form.atLeastOneProvider'))
      return
    }

    if (readConfig.providerId === providerConfig.id) {
      await setReadConfig({ providerId: updatedAllReadProviders[0].id })
    }
    if (translateConfig.providerId === providerConfig.id) {
      await setTranslateConfig({ providerId: chooseNextProviderConfig(updatedAllTranslateProviders).id })
    }
    if (ttsConfig.providerId === providerConfig.id) {
      if (updatedAllTTSProviders.length === 0) {
        await setTtsConfig({ providerId: null })
      }
      else {
        await setTtsConfig({ providerId: updatedAllTTSProviders[0].id })
      }
    }
    await setAllProvidersConfig(updatedAllProviders)
    setSelectedProviderId(chooseNextProviderConfig(updatedAllProviders).id)
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
          <ConfigHeader providerType={providerType} />
          <form.AppField
            name="name"
            validators={{
              onChange: ({ value }) => {
                const duplicateProvider = allProvidersConfig.find(provider =>
                  provider.name === value && provider.id !== providerConfig.id,
                )
                if (duplicateProvider) {
                  return i18n.t('options.apiProviders.form.duplicateProviderName', [value])
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
          <BaseURLField form={form} />
          {isTranslateProviderName && (
            <>
              <Separator className="my-2" />
              <DefaultTranslateProviderSelector form={form} />
              <TranslateModelSelector form={form} />
            </>
          )}
          {isReadProviderName && (
            <>
              <Separator className="my-2" />
              <DefaultReadProviderSelector form={form} />
              <ReadModelSelector form={form} />
            </>
          )}
          {isLLMProvider && (
            <AdvancedOptionsSection>
              <TemperatureField form={form} />
              <ProviderOptionsField form={form} />
            </AdvancedOptionsSection>
          )}
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
