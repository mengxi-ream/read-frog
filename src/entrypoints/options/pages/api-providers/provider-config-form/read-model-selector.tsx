import type { APIProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { useStore } from '@tanstack/react-form'
import { useSetAtom } from 'jotai'
import { Activity } from 'react'
import { toast } from 'sonner'
import { Checkbox } from '@/components/shadcn/checkbox'
import { SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { isCustomLLMProviderConfig, isReadProviderConfig, READ_PROVIDER_MODELS } from '@/types/config/provider'
import { providerConfigAtom, updateLLMProviderConfig } from '@/utils/atoms/provider'
import { cn } from '@/utils/styles/utils'
import { ModelSuggestionButton } from './components/model-suggestion-button'
import { withForm } from './form'

export const ReadModelSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const setProviderConfig = useSetAtom(providerConfigAtom(providerConfig.id))
    if (!isReadProviderConfig(providerConfig))
      return <></>
    const { isCustomModel, customModel, model } = providerConfig.models.read

    return (
      <div>
        <Activity mode={isCustomModel ? 'visible' : 'hidden'}>
          <form.AppField name="models.read.customModel">
            {field => (
              <field.InputField
                formForSubmit={form}
                label={(
                  <div className="flex items-end justify-between w-full">
                    <span>{i18n.t('options.apiProviders.form.models.read.customTitle')}</span>
                    {isCustomLLMProviderConfig(providerConfig) && (
                      <ModelSuggestionButton
                        baseURL={providerConfig.baseURL}
                        apiKey={providerConfig.apiKey}
                        onSelect={(model) => {
                          field.handleChange(model)
                          void form.handleSubmit()
                        }}
                      />
                    )}
                  </div>
                )}
                value={customModel ?? ''}
              />
            )}
          </form.AppField>
        </Activity>

        <Activity mode={isCustomModel ? 'hidden' : 'visible'}>
          <form.AppField name="models.read.model">
            {field => (
              <field.SelectField formForSubmit={form} label={i18n.t('options.apiProviders.form.models.read.title')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={i18n.t('options.apiProviders.form.models.read.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {READ_PROVIDER_MODELS[providerConfig.provider].map(model => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </field.SelectField>
            )}
          </form.AppField>
        </Activity>
        <div className="mt-2.5 flex items-center space-x-2">
          <form.Field name="models.read.isCustomModel">
            { field => (
              <div className={cn('flex items-center space-x-2', providerConfig.provider === 'openai-compatible' && 'hidden')}>
                <Checkbox
                  id="isCustomModel-read"
                  checked={field.state.value}
                  onCheckedChange={(checked) => {
                    try {
                      if (checked === false) {
                        void setProviderConfig(
                          updateLLMProviderConfig(providerConfig, {
                            models: {
                              read: {
                                customModel: null,
                                isCustomModel: false,
                              },
                            },
                          }),
                        )
                      }
                      else if (checked === true) {
                        void setProviderConfig(
                          updateLLMProviderConfig(providerConfig, {
                            models: {
                              read: {
                                customModel: model,
                                isCustomModel: true,
                              },
                            },
                          }),
                        )
                      }
                    }
                    catch (error) {
                      toast.error(error instanceof Error ? error.message : 'Failed to update configuration')
                    }
                  }}
                />
                <label
                  htmlFor="isCustomModel-read"
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                >
                  {i18n.t('options.general.readConfig.model.enterCustomModel')}
                </label>
              </div>
            )}
          </form.Field>
        </div>
      </div>
    )
  },
})
