import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import ProviderSelector from '@/components/llm-providers/provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { isAPIProviderConfig } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { featureProviderConfigAtom } from '@/utils/atoms/provider'
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
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const translateProviderConfig = useAtomValue(featureProviderConfigAtom('translate'))

  // some deeplx providers don't need api key
  const needSetAPIKey = translateProviderConfig && isAPIProviderConfig(translateProviderConfig) && translateProviderConfig.provider !== 'deeplx' && !translateProviderConfig.apiKey

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.translationConfig.provider')}
        {needSetAPIKey && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        featureKey="translate"
        value={translateConfig.providerId}
        onChange={id => void setTranslateConfig({ providerId: id })}
        excludeProviderTypes={translateConfig.mode === 'translationOnly' ? ['google-translate'] : undefined}
        className="w-full"
      />
    </Field>
  )
}
