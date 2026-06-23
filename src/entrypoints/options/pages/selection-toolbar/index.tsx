import { i18n } from "#imports"
import selectionToolbarDemoImage from "@/assets/demo/selection-toolbar.png"
import { GradientBackground } from "@/components/gradient-background"
import { PageLayout } from "../../components/page-layout"
import { SelectionToolbarDisabledSites } from "./selection-toolbar-disabled-sites"
import { SelectionToolbarFeatureToggles } from "./selection-toolbar-feature-toggles"
import { SelectionToolbarGlobalToggle } from "./selection-toolbar-global-toggle"
import { SelectionToolbarOpacity } from "./selection-toolbar-opacity"
import { SelectionTranslationShortcut } from "./selection-translation-shortcut"

export function SelectionToolbarPage() {
  return (
    <PageLayout title={i18n.t("options.overlayTools.selectionToolbar.title")}>
      <GradientBackground>
        <img
          src={selectionToolbarDemoImage}
          alt={i18n.t("options.floatingButtonAndToolbar.selectionToolbarDemoImageAlt")}
          className="w-100 h-auto"
        />
      </GradientBackground>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <SelectionToolbarGlobalToggle />
        <SelectionToolbarOpacity />
        <SelectionToolbarFeatureToggles />
        <SelectionTranslationShortcut />
        <SelectionToolbarDisabledSites />
      </div>
    </PageLayout>
  )
}
