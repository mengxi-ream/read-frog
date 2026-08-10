import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { AIContentAwareConfig } from "./ai-content-aware"
import { BuiltInAiUsageConfig } from "./built-in-ai-usage"
import { FeatureProvidersConfig } from "./feature-providers"
import { LanguageDetectionConfig } from "./language-detection"
import { ProvidersConfig } from "./providers-config"

export function ApiProvidersPage() {
  return (
    <PageLayout
      title={i18n.t("options.apiProviders.title")}
      description={i18n.t("options.apiProviders.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <ProvidersConfig />
      <FeatureProvidersConfig />
      <LanguageDetectionConfig />
      <AIContentAwareConfig />
      <BuiltInAiUsageConfig />
    </PageLayout>
  )
}
