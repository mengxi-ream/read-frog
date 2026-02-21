import type { ProviderConfig } from '@/types/config/provider'
import { i18n } from '#imports'
import { useAtom, useAtomValue } from 'jotai'
import ProviderSelector from '@/components/llm-providers/provider-selector'
import { Field, FieldLabel } from '@/components/ui/base-ui/field'
import { isAPIProviderConfig, isPureAPIProvider } from '@/types/config/provider'
import { configFieldsAtomMap } from '@/utils/atoms/config'
import { featureProviderConfigAtom } from '@/utils/atoms/provider'
import { ConfigCard } from '../../components/config-card'
import { SetApiKeyWarning } from '../../components/set-api-key-warning'

/** Pure API providers (e.g. DeepLX) don't require an API key */
function needsApiKeyWarning(providerConfig: ProviderConfig | null): boolean {
  return !!providerConfig
    && isAPIProviderConfig(providerConfig)
    && !isPureAPIProvider(providerConfig.provider)
    && !providerConfig.apiKey
}

export default function FeatureProvidersConfig() {
  return (
    <ConfigCard
      title={i18n.t('options.general.featureProviders.title')}
      description={i18n.t('options.general.featureProviders.description')}
    >
      <div className="space-y-4">
        <TranslateField />
        <SelectionToolbarTranslateField />
        <SelectionToolbarVocabularyInsightField />
        <TtsField />
        <InputTranslationField />
        <VideoSubtitlesField />
      </div>
    </ConfigCard>
  )
}

function TranslateField() {
  const [translateConfig, setTranslateConfig] = useAtom(configFieldsAtomMap.translate)
  const providerConfig = useAtomValue(featureProviderConfigAtom('translate'))

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.featureProviders.features.translate')}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
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

function SelectionToolbarTranslateField() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const providerConfig = useAtomValue(featureProviderConfigAtom('selectionToolbar.translate'))

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.featureProviders.features.selectionToolbar_translate')}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        featureKey="selectionToolbar.translate"
        value={selectionToolbar.features.translate.providerId}
        onChange={id => void setSelectionToolbar({
          ...selectionToolbar,
          features: {
            ...selectionToolbar.features,
            translate: { ...selectionToolbar.features.translate, providerId: id },
          },
        })}
        className="w-full"
      />
    </Field>
  )
}

function SelectionToolbarVocabularyInsightField() {
  const [selectionToolbar, setSelectionToolbar] = useAtom(configFieldsAtomMap.selectionToolbar)
  const providerConfig = useAtomValue(featureProviderConfigAtom('selectionToolbar.vocabularyInsight'))

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.featureProviders.features.selectionToolbar_vocabularyInsight')}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        featureKey="selectionToolbar.vocabularyInsight"
        value={selectionToolbar.features.vocabularyInsight.providerId}
        onChange={id => void setSelectionToolbar({
          ...selectionToolbar,
          features: {
            ...selectionToolbar.features,
            vocabularyInsight: { ...selectionToolbar.features.vocabularyInsight, providerId: id },
          },
        })}
        className="w-full"
      />
    </Field>
  )
}

function TtsField() {
  const [ttsConfig, setTtsConfig] = useAtom(configFieldsAtomMap.tts)
  const providerConfig = useAtomValue(featureProviderConfigAtom('tts'))

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.featureProviders.features.tts')}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        featureKey="tts"
        value={ttsConfig.providerId}
        onChange={id => void setTtsConfig({ providerId: id })}
        nullable
        className="w-full"
      />
    </Field>
  )
}

function InputTranslationField() {
  const [inputTranslation, setInputTranslation] = useAtom(configFieldsAtomMap.inputTranslation)
  const providerConfig = useAtomValue(featureProviderConfigAtom('inputTranslation'))

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.featureProviders.features.inputTranslation')}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        featureKey="inputTranslation"
        value={inputTranslation.providerId}
        onChange={id => void setInputTranslation({ ...inputTranslation, providerId: id })}
        className="w-full"
      />
    </Field>
  )
}

function VideoSubtitlesField() {
  const [videoSubtitles, setVideoSubtitles] = useAtom(configFieldsAtomMap.videoSubtitles)
  const providerConfig = useAtomValue(featureProviderConfigAtom('videoSubtitles'))

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t('options.general.featureProviders.features.videoSubtitles')}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        featureKey="videoSubtitles"
        value={videoSubtitles.providerId}
        onChange={id => void setVideoSubtitles({ ...videoSubtitles, providerId: id })}
        className="w-full"
      />
    </Field>
  )
}
