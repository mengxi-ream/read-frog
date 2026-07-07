import { FeatureProviderSelectorList, needsApiKeyWarning } from "@/components/llm-providers/feature-provider-selector-list"
import { i18n } from "@/utils/i18n"
import { ConfigCard } from "../../components/config-card"
import { SetApiKeyWarning } from "../../components/set-api-key-warning"

export default function FeatureProvidersConfig() {
  return (
    <ConfigCard
      id="feature-providers"
      title={i18n.t("options.general.featureProviders.title")}
      description={i18n.t("options.general.featureProviders.description")}
    >
      <FeatureProviderSelectorList
        renderApiKeyWarning={providerConfig =>
          needsApiKeyWarning(providerConfig) ? <SetApiKeyWarning /> : null}
      />
    </ConfigCard>
  )
}
