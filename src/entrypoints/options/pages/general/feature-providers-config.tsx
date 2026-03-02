import type { ProviderConfig } from "@/types/config/provider"
import type { FeatureKey } from "@/utils/constants/feature-providers"
import { i18n } from "#imports"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { isAPIProviderConfig, isLLMProviderConfig, isPureAPIProvider } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { featureProviderConfigAtom } from "@/utils/atoms/provider"
import { filterEnabledProvidersConfig, getProviderConfigById } from "@/utils/config/helpers"
import { buildFeatureProviderPatch, FEATURE_KEY_I18N_MAP, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { ConfigCard } from "../../components/config-card"
import { SetApiKeyWarning } from "../../components/set-api-key-warning"

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
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const def = FEATURE_PROVIDER_DEFS[featureKey]
  const providerId = def.getProviderId(config)
  const providerConfig = useAtomValue(featureProviderConfigAtom(featureKey))

  const providers = useMemo(() =>
    filterEnabledProvidersConfig(providersConfig)
      .filter(p => def.isProvider(p.provider))
      .filter(p => !excludeProviderTypes?.includes(p.provider)),
  [providersConfig, def, excludeProviderTypes])

  return (
    <Field>
      <FieldLabel nativeLabel={false} render={<div />}>
        {i18n.t(`options.general.featureProviders.features.${FEATURE_KEY_I18N_MAP[featureKey]}`)}
        {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
      </FieldLabel>
      <ProviderSelector
        providers={providers}
        value={providerId}
        onChange={id => void setConfig(buildFeatureProviderPatch({ [featureKey]: id }))}
        className="w-full"
      />
    </Field>
  )
}

function CustomFeatureProviderFields() {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const llmProviders = useMemo(
    () => filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig),
    [providersConfig],
  )

  const customFeatures = config.selectionToolbar.customFeatures

  if (customFeatures.length === 0) {
    return null
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {i18n.t("options.general.featureProviders.customFeatures")}
      </p>
      {customFeatures.map((feature) => {
        const currentProviderConfig = getProviderConfigById(providersConfig, feature.providerId) ?? null
        return (
          <Field key={feature.id}>
            <FieldLabel nativeLabel={false} render={<div />}>
              {feature.name}
              {needsApiKeyWarning(currentProviderConfig) && <SetApiKeyWarning />}
            </FieldLabel>
            <ProviderSelector
              providers={llmProviders}
              value={feature.providerId}
              onChange={(id) => {
                const updatedCustomFeatures = config.selectionToolbar.customFeatures.map(item =>
                  item.id === feature.id
                    ? { ...item, providerId: id }
                    : item,
                )

                void setConfig({
                  selectionToolbar: {
                    ...config.selectionToolbar,
                    customFeatures: updatedCustomFeatures,
                  },
                })
              }}
              className="w-full"
              placeholder={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.form.selectProvider")}
            />
          </Field>
        )
      })}
    </>
  )
}

export default function FeatureProvidersConfig() {
  const config = useAtomValue(configAtom)

  return (
    <ConfigCard
      title={i18n.t("options.general.featureProviders.title")}
      description={i18n.t("options.general.featureProviders.description")}
    >
      <div className="space-y-4">
        <FeatureProviderField
          featureKey="translate"
          excludeProviderTypes={config.translate.mode === "translationOnly" ? ["google-translate"] : undefined}
        />
        <FeatureProviderField featureKey="videoSubtitles" />
        <FeatureProviderField featureKey="selectionToolbar.translate" />
        <FeatureProviderField featureKey="selectionToolbar.vocabularyInsight" />
        <FeatureProviderField featureKey="inputTranslation" />
        <CustomFeatureProviderFields />
      </div>
    </ConfigCard>
  )
}
