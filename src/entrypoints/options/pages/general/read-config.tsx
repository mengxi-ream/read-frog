import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import { toast } from 'sonner'
import ReadProviderSelector from '@/components/llm-providers/read-provider-selector'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Field, FieldLabel } from '@/components/shadcn/field'
import { Input } from '@/components/shadcn/input'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/shadcn/select'
import { READ_PROVIDER_MODELS } from '@/types/config/provider'
import { readProviderConfigAtom, updateLLMProviderConfig } from '@/utils/atoms/provider'
import { cn } from '@/utils/styles/tailwind'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

export function ReadConfig() {
  return (
    <ConfigCard title={i18n.t('options.general.readConfig.title')} description={i18n.t('options.general.readConfig.description')}>
      <div className="flex flex-col gap-4">
        <ReadProviderSelectorField />
        <ReadModelSelector />
      </div>
    </ConfigCard>
  )
}

function ReadProviderSelectorField() {
  const readProviderConfig = useAtomValue(readProviderConfigAtom)

  return (
    <Field>
      <FieldLabel htmlFor="readProvider">
        {i18n.t('options.general.readConfig.provider')}
        {!readProviderConfig.apiKey && <SetApiKeyWarning />}
      </FieldLabel>
      <ReadProviderSelector className="w-full" />
    </Field>
  )
}

function ReadModelSelector() {
  const [readProviderConfig, setReadProviderConfig] = useAtom(readProviderConfigAtom)
  const provider = readProviderConfig.provider
  const modelConfig = readProviderConfig.models.read

  return (
    <Field>
      <FieldLabel htmlFor="readModel">
        {i18n.t('options.general.readConfig.model.title')}
      </FieldLabel>
      {modelConfig.isCustomModel
        ? (
            <Input
              value={modelConfig.customModel ?? ''}
              onChange={(e) => {
                try {
                  void setReadProviderConfig(
                    updateLLMProviderConfig(readProviderConfig, {
                      models: {
                        read: {
                          customModel: e.target.value === '' ? null : e.target.value,
                        },
                      },
                    }),
                  )
                }
                catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to update configuration')
                }
              }}
            />
          )
        : (
            <Select
              value={modelConfig.model}
              onValueChange={(value) => {
                try {
                  void setReadProviderConfig(
                    updateLLMProviderConfig(readProviderConfig, {
                      models: {
                        read: {
                          model: value as any,
                        },
                      },
                    }),
                  )
                }
                catch (error) {
                  toast.error(error instanceof Error ? error.message : 'Failed to update configuration')
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {READ_PROVIDER_MODELS[provider].map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          )}
      <div className={cn('mt-0.5 flex items-center space-x-2', provider === 'openai-compatible' && 'hidden')}>
        <Checkbox
          id={`isCustomModel-read-${provider}`}
          checked={modelConfig.isCustomModel}
          onCheckedChange={(checked) => {
            try {
              if (checked === false) {
                void setReadProviderConfig(
                  updateLLMProviderConfig(readProviderConfig, {
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
                void setReadProviderConfig(
                  updateLLMProviderConfig(readProviderConfig, {
                    models: {
                      read: {
                        customModel: modelConfig.model,
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
          htmlFor={`isCustomModel-read-${provider}`}
          className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
        >
          {i18n.t('options.general.readConfig.model.enterCustomModel')}
        </label>
      </div>
    </Field>
  )
}
