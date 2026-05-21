import { i18n } from "#imports"
import { useAtomValue, useSetAtom } from "jotai"
import { useMemo } from "react"
import ProviderSelector from "@/components/llm-providers/provider-selector"
import { Field, FieldLabel } from "@/components/ui/base-ui/field"
import { isAPIProviderConfig, isPureAPIProvider } from "@/types/config/provider"
import { configAtom, configFieldsAtomMap, writeConfigAtom } from "@/utils/atoms/config"
import { featureProviderConfigAtom } from "@/utils/atoms/provider"
import { filterEnabledProvidersConfig } from "@/utils/config/helpers"
import { buildFeatureProviderPatch, FEATURE_PROVIDER_DEFS } from "@/utils/constants/feature-providers"
import { ConfigCard } from "../../components/config-card"
import { SetApiKeyWarning } from "../../components/set-api-key-warning"

function needsApiKeyWarning(providerConfig: any): boolean {
  return !!providerConfig
    && isAPIProviderConfig(providerConfig)
    && !isPureAPIProvider(providerConfig.provider)
    && !providerConfig.apiKey
}

export function SelectionTranslationProvider() {
  const config = useAtomValue(configAtom)
  const setConfig = useSetAtom(writeConfigAtom)
  const providersConfig = useAtomValue(configFieldsAtomMap.providersConfig)
  const def = FEATURE_PROVIDER_DEFS.selectionTranslation
  const providerId = def.getProviderId(config)
  const providerConfig = useAtomValue(featureProviderConfigAtom("selectionTranslation"))

  const providers = useMemo(() =>
    filterEnabledProvidersConfig(providersConfig)
      .filter(p => def.isProvider(p.provider)),
  [providersConfig, def])

  return (
    <ConfigCard
      id="selection-translation-provider"
      title={i18n.t("options.selectionTranslation.provider.title")}
      description={i18n.t("options.selectionTranslation.provider.description")}
    >
      <Field>
        <FieldLabel nativeLabel={false} render={<div className="flex flex-wrap" />}>
          {i18n.t("options.selectionTranslation.provider.label")}
          {needsApiKeyWarning(providerConfig) && <SetApiKeyWarning />}
        </FieldLabel>
        <ProviderSelector
          providers={providers}
          value={providerId}
          onChange={id => void setConfig(buildFeatureProviderPatch({ selectionTranslation: id }))}
          className="w-full"
        />
      </Field>
    </ConfigCard>
  )
}
