import selectionToolbarDemoImage from "@/assets/demo/selection-toolbar.png"
import { GradientBackground } from "@/components/gradient-background"
import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { ActionsSection } from "./actions"
import { DisplaySection } from "./display"
import { EnableItem } from "./enable-item"

export function SelectionToolbarPage() {
  return (
    <PageLayout
      title={i18n.t("options.overlayTools.selectionToolbar.title")}
      description={i18n.t("options.overlayTools.selectionToolbar.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <GradientBackground>
        <img
          src={selectionToolbarDemoImage}
          alt={i18n.t("options.floatingButtonAndToolbar.selectionToolbarDemoImageAlt")}
          className="h-auto w-100"
        />
      </GradientBackground>
      <EnableItem />
      <ActionsSection />
      <DisplaySection />
    </PageLayout>
  )
}
