import type { APIProviderConfig, LLMTranslateProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { Icon } from '@iconify/react'
import { useStore } from '@tanstack/react-form'
import { useMemo, useState } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/shadcn/collapsible'
import { Field, FieldError, FieldLabel } from '@/components/shadcn/field'
import { JSONCodeEditor } from '@/components/ui/json-code-editor'
import { isLLMTranslateProviderConfig } from '@/types/config/provider'
import { getProviderOptions } from '@/utils/providers/options'
import { cn } from '@/utils/styles/tailwind'
import { withForm } from './form'

export const ProviderOptionsField = withForm({
  ...{ defaultValues: {} as APIProviderConfig },
  render: function Render({ form }) {
    const [isOpen, setIsOpen] = useState(false)
    const providerConfig = useStore(form.store, state => state.values)
    const isLLMProvider = isLLMTranslateProviderConfig(providerConfig)

    // Compute translate model - safe to call unconditionally since we check isLLMProvider in render
    const translateModel = useMemo(() => {
      if (!isLLMProvider) {
        return null
      }
      const llmConfig = providerConfig as LLMTranslateProviderConfig
      return llmConfig.models.translate.isCustomModel
        ? llmConfig.models.translate.customModel
        : llmConfig.models.translate.model
    }, [isLLMProvider, providerConfig])

    // Get default options for placeholder
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

    // Only show for LLM providers
    if (!isLLMProvider) {
      return null
    }

    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mt-4">
        <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground cursor-pointer py-2">
          <Icon
            icon="tabler:chevron-right"
            className={cn(
              'size-4 transition-transform duration-200',
              isOpen && 'rotate-90',
            )}
          />
          <span>{i18n.t('options.apiProviders.form.advancedOptions')}</span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ProviderOptionsEditor
            form={form}
            placeholderText={placeholderText}
            hasDefaultOptions={Object.keys(defaultOptions).length > 0}
          />
        </CollapsibleContent>
      </Collapsible>
    )
  },
})

interface ProviderOptionsEditorProps {
  form: any
  placeholderText: string
  hasDefaultOptions: boolean
}

function ProviderOptionsEditor({ form, placeholderText, hasDefaultOptions }: ProviderOptionsEditorProps) {
  const [jsonError, setJsonError] = useState<string | null>(null)

  return (
    <form.Field name="providerOptions">
      {(field: any) => (
        <ProviderOptionsEditorInner
          field={field}
          form={form}
          placeholderText={placeholderText}
          hasDefaultOptions={hasDefaultOptions}
          jsonError={jsonError}
          setJsonError={setJsonError}
        />
      )}
    </form.Field>
  )
}

interface ProviderOptionsEditorInnerProps {
  field: any
  form: any
  placeholderText: string
  hasDefaultOptions: boolean
  jsonError: string | null
  setJsonError: (error: string | null) => void
}

function ProviderOptionsEditorInner({
  field,
  form,
  placeholderText,
  hasDefaultOptions,
  jsonError,
  setJsonError,
}: ProviderOptionsEditorInnerProps) {
  const stringValue = useMemo(() => {
    if (!field.state.value) {
      return ''
    }
    return JSON.stringify(field.state.value, null, 2)
  }, [field.state.value])

  const handleChange = (value: string) => {
    if (!value.trim()) {
      setJsonError(null)
      field.handleChange(undefined)
      void form.handleSubmit()
      return
    }
    try {
      const parsed = JSON.parse(value)
      setJsonError(null)
      field.handleChange(parsed)
      void form.handleSubmit()
    }
    catch {
      setJsonError(i18n.t('options.apiProviders.form.invalidJson'))
    }
  }

  return (
    <Field className="mt-2">
      <FieldLabel>
        <div className="flex items-center justify-between w-full">
          <span>{i18n.t('options.apiProviders.form.providerOptions')}</span>
          {hasDefaultOptions && (
            <span className="text-xs text-muted-foreground">
              {i18n.t('options.apiProviders.form.providerOptionsHint')}
            </span>
          )}
        </div>
      </FieldLabel>
      <JSONCodeEditor
        value={stringValue}
        onChange={handleChange}
        placeholder={placeholderText}
        hasError={!!jsonError}
        height="150px"
      />
      {jsonError && (
        <FieldError>{jsonError}</FieldError>
      )}
    </Field>
  )
}
