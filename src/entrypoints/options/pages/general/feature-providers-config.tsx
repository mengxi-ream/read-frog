import type { ProviderConfig } from '@/types/config/provider'
import type { FeatureKey } from '@/utils/constants/feature-providers'
import { i18n } from '#imports'
import { useAtomValue, useSetAtom } from 'jotai'
import ProviderSelector from '@/components/llm-providers/provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { isAPIProviderConfig, isPureAPIProvider } from '@/types/config/provider'
import { configAtom, writeConfigAtom } from '@/utils/atoms/config'
import { featureProviderConfigAtom } from '@/utils/atoms/provider'
import { buildFeatureProviderPatch, FEATURE_KEY_I18N_MAP, FEATURE_PROVIDER_DEFS } from '@/utils/constants/feature-providers'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

/** Pure API providers (e.g. DeepLX) don't require an API key */
function needsApiKeyWarning(providerConfig: ProviderConfig | null): boolean {
  return !!providerConfig
    && isAPIProviderConfig(providerConfig)
    && !isPureAPIProvider(providerConfig.provider)
    && !providerConfig.apiKey
}

function FeatureProviderField({ featureKey, excludeProviderTypes }: {
  featureKey: FeatureKey
  excludeProviderTypes?: string[]
}) {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const def = FEATURE_PROVIDER_DEFS[featureKey]
  const providerId = def.getProviderId(config)
  const providerConfig = useAtomValue(featureProviderConfigAtom(featureKey))

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t(`options.general.featureProviders.features.${FEATURE_KEY_I18N_MAP[featureKey]}`)}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        featureKey={featureKey}
        value={providerId}
        onChange={id => void setConfig(buildFeatureProviderPatch({ [featureKey]: id }))}
        nullable={def.nullable || undefined}
        excludeProviderTypes={excludeProviderTypes}
        className="w-full"
      />
    </Field>
  )
}

export default function FeatureProvidersConfig() {
  const config = useAtomValue(configAtom)

  return (
    <ConfigCard
      title={i18n.t('options.general.featureProviders.title')}
      description={i18n.t('options.general.featureProviders.description')}
    >
      <div className="space-y-4">
        <FeatureProviderField
          featureKey="translate"
          excludeProviderTypes={config.translate.mode === 'translationOnly' ? ['google-translate'] : undefined}
        />
        <FeatureProviderField featureKey="videoSubtitles" />
        <FeatureProviderField featureKey="selectionToolbar.translate" />
        <FeatureProviderField featureKey="selectionToolbar.vocabularyInsight" />
        <FeatureProviderField featureKey="tts" />
        <FeatureProviderField featureKey="inputTranslation" />
      </div>
    </ConfigCard>
  )
}
