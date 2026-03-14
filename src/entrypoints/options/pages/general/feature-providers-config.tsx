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
      <FieldLabel nativeLabel={false} render={<div className="flex flex-wrap" />}>
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

function CustomActionProviderFields() {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)

  const llmProviders = useMemo(
    () => filterEnabledProvidersConfig(providersConfig).filter(isLLMProviderConfig),
    [providersConfig],
  )

  const customActions = config.selectionToolbar.customActions

  if (customActions.length === 0) {
    return null
  }

  return (
    <>
      <p className="text-sm font-medium text-muted-foreground">
        {i18n.t("options.general.featureProviders.customActions")}
      </p>
      {customActions.map((action) => {
        const currentProviderConfig = getProviderConfigById(providersConfig, action.providerId) ?? null
        return (
          <Field key={action.id}>
            <FieldLabel nativeLabel={false} render={<div />}>
              {action.name}
              {needsApiKeyWarning(currentProviderConfig) && <SetApiKeyWarning />}
            </FieldLabel>
            <ProviderSelector
              providers={llmProviders}
              value={action.providerId}
              onChange={(id) => {
                const updatedCustomActions = config.selectionToolbar.customActions.map(item =>
                  item.id === action.id
                    ? { ...item, providerId: id }
                    : item,
                )

                void setConfig({
                  selectionToolbar: {
                    ...config.selectionToolbar,
                    customActions: updatedCustomActions,
                  },
                })
              }}
              className="w-full"
              placeholder={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.form.selectProvider")}
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
      id="feature-providers"
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
        <CustomActionProviderFields />
      </div>
    </ConfigCard>
  )
}
