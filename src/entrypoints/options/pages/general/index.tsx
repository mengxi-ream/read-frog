import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import AppearanceSettings from "./appearance-settings"
import FeatureProvidersConfig from "./feature-providers-config"
import LanguageDetectionConfig from "./language-detection-config"
import SiteControlMode from "./site-control-mode"
import UiLanguageSelector from "./ui-language-selector"

export function GeneralPage() {
  return (
    <PageLayout title={i18n.t("options.general.title")} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <FeatureProvidersConfig />
      <LanguageDetectionConfig />
      <SiteControlMode />
      <UiLanguageSelector />
      <AppearanceSettings />
    </PageLayout>
  )
}
