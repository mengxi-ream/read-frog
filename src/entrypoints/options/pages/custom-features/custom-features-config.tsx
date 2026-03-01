import { i18n } from "#imports"
import { Badge } from "@/components/ui/base-ui/badge"
import { ConfigCard } from "../../components/config-card"
import { EntityEditorLayout } from "../../components/entity-editor-layout"
import { CustomFeatureCardList } from "./components/feature-card-list"
import { CustomFeatureConfigForm } from "./feature-config-form"

export function CustomFeaturesConfig() {
  return (
    <ConfigCard
      title={(
        <span className="inline-flex items-center gap-2">
          {i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.title")}
          <Badge variant="secondary" className="text-xs font-medium">Public Beta</Badge>
        </span>
      )}
      description={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customFeatures.description")}
      className="lg:flex-col"
    >
      <EntityEditorLayout list={<CustomFeatureCardList />} editor={<CustomFeatureConfigForm />} />
    </ConfigCard>
  )
}
