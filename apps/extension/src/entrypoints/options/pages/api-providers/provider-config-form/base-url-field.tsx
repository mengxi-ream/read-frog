import type { APIProviderConfig } from '@/types/config/provider'

import { i18n } from '#imports'
import { useStore } from '@tanstack/react-form'
import { isNonCustomLLMProvider } from '@/types/config/provider'
import { ConnectionTestButton } from './components/connection-button'
import { withForm } from './form'

export const BaseURLField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const providerType = providerConfig.provider
    const labelText = `${i18n.t('options.apiProviders.form.fields.baseURL')}${isNonCustomLLMProvider(providerType)
      ? ` (${i18n.t('options.apiProviders.form.fields.optional')})`
      : ''}`

    return (
      <form.AppField name="baseURL">
        {field => (
          <field.InputField
            formForSubmit={form}
            label={providerType !== 'ollama'
              ? labelText
              : (
                  (
                    <div className="flex items-end justify-between">
                      <span className="text-sm font-medium">
                        {labelText}
                      </span>
                      <ConnectionTestButton
                        providerConfig={providerConfig}
                      />
                    </div>
                  )
                )}
          />
        )}
      </form.AppField>
    )
  },
})
