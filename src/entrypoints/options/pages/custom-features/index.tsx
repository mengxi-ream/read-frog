import { i18n } from "#imports"
import { PageLayout } from "../../components/page-layout"
import { CustomFeaturesConfig } from "./custom-features-config"

export function CustomFeaturesPage() {
  return (
    <PageLayout title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.title")}>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <CustomFeaturesConfig />
      </div>
    </PageLayout>
  )
}
