import { i18n } from "@/utils/i18n"
import { hasSidePanel } from "@/utils/side-panel"
import { PageLayout } from "../../components/page-layout"
import { ClickActionSection } from "./click-action"
import { DisplaySection } from "./display"
import { FloatingButtonPreview } from "./floating-button-preview"

export function FloatingButtonPage() {
  // Without a side panel, translating is the only thing a click can do.
  const hasClickAction = hasSidePanel()

  return (
    <PageLayout
      title={i18n.t("options.floatingButton.title")}
      description={i18n.t(
        hasClickAction
          ? "options.floatingButton.pageDescription"
          : "options.floatingButton.pageDescriptionWithoutClickAction",
      )}
      innerClassName="flex flex-col gap-10"
    >
      <FloatingButtonPreview />
      <DisplaySection />
      {hasClickAction && <ClickActionSection />}
    </PageLayout>
  )
}
