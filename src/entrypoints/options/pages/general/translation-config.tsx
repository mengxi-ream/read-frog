import { i18n } from '#imports'
import { useAtomValue } from 'jotai'
import TranslateProviderSelector from '@/components/llm-providers/translate-provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { isAPIProviderConfig } from '@/types/config/provider'
import { translateProviderConfigAtom } from '@/utils/atoms/provider'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'
import { RangeSelector } from './components/range-selector'

export default function TranslationConfig() {
  return (
    <ConfigCard title={i18n.t('options.general.translationConfig.title')} description={i18n.t('options.general.translationConfig.description')}>
      <div className="space-y-4">
        <TranslateProviderSelectorField />
        <RangeSelector />
      </div>
    </ConfigCard>
  )
}

function TranslateProviderSelectorField() {
  const translateProviderConfig = useAtomValue(translateProviderConfigAtom)

  // some deeplx providers don't need api key
  const needSetAPIKey = translateProviderConfig && isAPIProviderConfig(translateProviderConfig) && translateProviderConfig.provider !== 'deeplx' && !translateProviderConfig.apiKey

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.translationConfig.provider')}
        {needSetAPIKey && <SetApiKeyWarning />}
      </FieldLabel>
      <TranslateProviderSelector className="w-full" />
    </Field>
  )
}
