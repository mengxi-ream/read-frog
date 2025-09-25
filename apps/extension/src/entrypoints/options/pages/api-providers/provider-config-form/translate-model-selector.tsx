import type { APIProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { Checkbox } from '@repo/ui/components/checkbox'
import { SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@repo/ui/components/select'
import { cn } from '@repo/ui/lib/utils'
import { useStore } from '@tanstack/react-form'
import { useSetAtom } from 'jotai'
import { toast } from 'sonner'
import { isLLMTranslateProviderConfig, TRANSLATE_PROVIDER_MODELS } from '@/types/config/provider'
import { providerConfigAtom, updateLLMProviderConfig } from '@/utils/atoms/provider'
import { withForm } from './form'

export const TranslateModelSelector = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const setProviderConfig = useSetAtom(providerConfigAtom(providerConfig.id))
    if (!isLLMTranslateProviderConfig(providerConfig))
      return <></>

    const { isCustomModel, customModel } = providerConfig.models.translate

    return (
      <div>
        {
          isCustomModel
            ? (
                <form.AppField name="models.translate.customModel">
                  {field => <field.InputField formForSubmit={form} label={i18n.t('options.apiProviders.form.models.translate.customTitle')} value={customModel ?? ''} />}
                </form.AppField>
              )
            : (
                <form.AppField name="models.translate.model">
                  {field => (
                    <field.SelectField formForSubmit={form} label={i18n.t('options.apiProviders.form.models.translate.title')}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={i18n.t('options.apiProviders.form.models.translate.placeholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {TRANSLATE_PROVIDER_MODELS[providerConfig.provider].map(model => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </field.SelectField>
                  )}
                </form.AppField>
              )
        }
        <div className="mt-2.5 flex items-center space-x-2">
          <form.Field name="models.translate">
            { field => (
              <div className={cn('flex items-center space-x-2', providerConfig.provider === 'openaiCompatible' && 'hidden')}>
                <Checkbox
                  id="isCustomModel-translate"
                  checked={field.state.value.isCustomModel}
                  onCheckedChange={(checked) => {
                    try {
                      if (checked === false) {
                        void setProviderConfig(
                          updateLLMProviderConfig(providerConfig, {
                            models: {
                              translate: {
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
                              translate: {
                                customModel: field.state.value.model,
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
                  htmlFor="isCustomModel-translate"
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
