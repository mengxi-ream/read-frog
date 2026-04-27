import { i18n } from "#imports"
import { PageLayout } from "../../components/page-layout"
import AppLanguageSettings from "./app-language-settings"
import AppearanceSettings from "./appearance-settings"
import FeatureProvidersConfig from "./feature-providers-config"
import LanguageDetectionConfig from "./language-detection-config"
import SiteControlMode from "./site-control-mode"

export function GeneralPage() {
  return (
    <PageLayout title={i18n.t("options.general.title")} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <FeatureProvidersConfig />
      <LanguageDetectionConfig />
      <SiteControlMode />
      <AppearanceSettings />
      <AppLanguageSettings />
    </PageLayout>
  )
}
