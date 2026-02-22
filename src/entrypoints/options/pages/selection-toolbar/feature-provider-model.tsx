import type { Config } from '@/types/config/config'
import type { FeatureKey } from '@/utils/constants/feature-providers'
import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import { useEffect } from 'react'
import ProviderSelector from '@/components/llm-providers/provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { filterEnabledProvidersConfig, getProviderConfigById } from '@/utils/config/helpers'
import { FEATURE_PROVIDER_DEFS } from '@/utils/constants/feature-providers'
import { ConfigCard } from '../../components/config-card'

type SelectionToolbarFeatureKey = keyof Config['selectionToolbar']['features']
type SelectionToolbarFeatureConfig = Config['selectionToolbar']['features'][SelectionToolbarFeatureKey]

const TOOLBAR_FEATURE_KEY: Record<SelectionToolbarFeatureKey, FeatureKey> = {
  translate: 'selectionToolbar.translate',
  vocabularyInsight: 'selectionToolbar.vocabularyInsight',
}

function SelectionToolbarFeatureProviderModelCard({
  featureKey,
  title,
  description,
}: {
  featureKey: SelectionToolbarFeatureKey
  title: string
  description: string
}) {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const globalFeatureKey = TOOLBAR_FEATURE_KEY[featureKey]
  const def = FEATURE_PROVIDER_DEFS[globalFeatureKey]
  const filteredProvidersConfig = filterEnabledProvidersConfig(providersConfig)
  const providers = filteredProvidersConfig.filter(p => def.isProvider(p.provider))

  const featureConfig = selectionToolbar.features[featureKey]
  const currentProvider = getProviderConfigById(providers, featureConfig.providerId)

  const updateFeatureConfig = (patch: Partial<SelectionToolbarFeatureConfig>) => {
    void setSelectionToolbar({
      ...selectionToolbar,
      features: {
        ...selectionToolbar.features,
        [featureKey]: { ...featureConfig, ...patch },
      },
    })
  }

  useEffect(() => {
    if (!currentProvider)
      return

    if (featureConfig.providerId !== currentProvider.id) {
      updateFeatureConfig({
        providerId: currentProvider.id,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProvider?.id])

  if (providers.length === 0) {
    return (
      <ConfigCard title={title} description={description}>
        <p className="text-sm text-muted-foreground">{i18n.t('options.floatingButtonAndToolbar.selectionToolbar.features.noProviderAvailable')}</p>
      </ConfigCard>
    )
  }

  return (
    <ConfigCard title={title} description={description}>
      <div className="flex flex-col gap-3">
        <Field>
          <FieldLabel>{i18n.t('options.floatingButtonAndToolbar.selectionToolbar.features.provider')}</FieldLabel>
          <ProviderSelector
            featureKey={globalFeatureKey}
            value={featureConfig.providerId}
            onChange={id => updateFeatureConfig({ providerId: id })}
            placeholder={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.features.selectProvider')}
            className="w-full"
          />
        </Field>
      </div>
    </ConfigCard>
  )
}

export function SelectionToolbarTranslateFeatureConfig() {
  return (
    <SelectionToolbarFeatureProviderModelCard
      featureKey="translate"
      title={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.features.translate.title')}
      description={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.features.translate.description')}
    />
  )
}

export function SelectionToolbarVocabularyInsightFeatureConfig() {
  return (
    <SelectionToolbarFeatureProviderModelCard
      featureKey="vocabularyInsight"
      title={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.features.vocabularyInsight.title')}
      description={i18n.t('options.floatingButtonAndToolbar.selectionToolbar.features.vocabularyInsight.description')}
    />
  )
}
