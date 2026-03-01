import { i18n } from "#imports"
import { ConfigCard } from "../../components/config-card"
import { EntityEditorLayout } from "../../components/entity-editor-layout"
import { CustomFeatureCardList } from "./components/feature-card-list"
import { CustomFeatureConfigForm } from "./feature-config-form"

export function CustomFeaturesConfig() {
  return (
    <ConfigCard
      title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.title")}
      description={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.description")}
      className="lg:flex-col"
    >
      <EntityEditorLayout list={<CustomFeatureCardList />} editor={<CustomFeatureConfigForm />} />
    </ConfigCard>
  )
}
