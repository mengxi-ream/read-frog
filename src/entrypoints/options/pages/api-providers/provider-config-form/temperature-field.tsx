import type { APIProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { useStore } from '@tanstack/react-form'
import { Hint } from '@/components/shadcn/hint'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { withForm } from './form'

export const TemperatureField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const isLLMProvider = isLLMTranslateProviderConfig(providerConfig)

    if (!isLLMProvider) {
      return null
    }

    return (
      <form.AppField name="temperature">
        {field => (
          <field.InputField
            formForSubmit={form}
            label={(
              <div className="flex items-center gap-1.5">
                <span>{i18n.t('options.apiProviders.form.temperature')}</span>
                <Hint content={i18n.t('options.apiProviders.form.temperatureHint')} />
              </div>
            )}
            type="number"
            min={0}
            step={0.01}
          />
        )}
      </form.AppField>
    )
  },
})
