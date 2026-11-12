import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { ActionsSection } from "./actions"
import { AnnotationSection } from "./annotation"
import { DisplaySection } from "./display"
import { EnableItem } from "./enable-item"
import { SelectionToolbarPreview } from "./selection-toolbar-preview"

export function SelectionToolbarPage() {
  return (
    <PageLayout
      title={i18n.t("options.selectionToolbar.title")}
      description={i18n.t("options.selectionToolbar.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <SelectionToolbarPreview />
      <EnableItem />
      <ActionsSection />
      <AnnotationSection />
      <DisplaySection />
    </PageLayout>
  )
}
