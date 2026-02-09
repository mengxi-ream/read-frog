import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
import ReadProviderSelector from '@/components/llm-providers/read-provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { readProviderConfigAtom } from '@/utils/atoms/provider'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

export function ReadConfig() {
  return (
    <ConfigCard title={i18n.t('options.general.readConfig.title')} description={i18n.t('options.general.readConfig.description')}>
      <div className="flex flex-col gap-4">
        <ReadProviderSelectorField />
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
