import type { APIProviderConfig, LLMTranslateProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { useStore } from '@tanstack/react-form'
import { useEffect, useMemo, useState } from 'react'
import { Field, FieldError, FieldLabel } from '@/components/shadcn/field'
import { Hint } from '@/components/shadcn/hint'
import { JSONCodeEditor } from '@/components/ui/json-code-editor'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { getProviderOptions } from '@/utils/providers/options'
import { withForm } from './form'

function parseJson(input: string): { valid: true, value: Record<string, unknown> | undefined } | { valid: false, error: string } {
  if (!input.trim()) {
    return { valid: true, value: undefined }
  }
  try {
    return { valid: true, value: JSON.parse(input) }
  }
  catch {
    return { valid: false, error: i18n.t('options.apiProviders.form.invalidJson') }
  }
}

export const ProviderOptionsField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const providerConfig = useStore(form.store, state => state.values)
    const isLLMProvider = isLLMTranslateProviderConfig(providerConfig)

    // Local state for the JSON string input
    const initialValue = providerConfig.providerOptions
      ? JSON.stringify(providerConfig.providerOptions, null, 2)
      : ''
    const [jsonInput, setJsonInput] = useState(initialValue)

    // Debounce the input value
    const debouncedJsonInput = useDebouncedValue(jsonInput, 500)

    // Derive parse result from debounced value
    const parseResult = useMemo(() => parseJson(debouncedJsonInput), [debouncedJsonInput])

    // Submit when debounced value changes and is valid
    useEffect(() => {
      if (parseResult.valid) {
        form.setFieldValue('providerOptions', parseResult.value)
        void form.handleSubmit()
      }
    }, [parseResult, form])

    const translateModel = useMemo(() => {
      if (!isLLMProvider) {
        return null
      }
      const llmConfig = providerConfig as LLMTranslateProviderConfig
      return llmConfig.models.translate.isCustomModel
        ? llmConfig.models.translate.customModel
        : llmConfig.models.translate.model
    }, [isLLMProvider, providerConfig])

    const defaultOptions = useMemo(() => {
      if (!isLLMProvider || !translateModel) {
        return {}
      }
      const options = getProviderOptions(translateModel, providerConfig.provider)
      return options[providerConfig.provider] || {}
    }, [isLLMProvider, translateModel, providerConfig.provider])

    const placeholderText = useMemo(() => {
      if (Object.keys(defaultOptions).length === 0) {
        return '{\n  \n}'
      }
      return JSON.stringify(defaultOptions, null, 2)
    }, [defaultOptions])

    if (!isLLMProvider) {
      return null
    }

    const jsonError = !parseResult.valid ? parseResult.error : null

    return (
      <Field>
        <FieldLabel>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-1.5">
              <span>{i18n.t('options.apiProviders.form.providerOptions')}</span>
              <Hint content={i18n.t('options.apiProviders.form.providerOptionsHint')} />
            </div>
            <a
              href="https://ai-sdk.dev/providers/ai-sdk-providers"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-link hover:opacity-90"
            >
              {i18n.t('options.apiProviders.form.providerOptionsDocsLink')}
            </a>
          </div>
        </FieldLabel>
        <JSONCodeEditor
          value={jsonInput}
          onChange={setJsonInput}
          placeholder={placeholderText}
          hasError={!!jsonError}
          height="150px"
        />
        {jsonError && (
          <FieldError>{jsonError}</FieldError>
        )}
      </Field>
    )
  },
})
