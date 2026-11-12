import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { ContextMenuPreview } from "./context-menu-preview"
import { EnableItem } from "./enable-item"

export function ContextMenuPage() {
  return (
    <PageLayout
      title={i18n.t("options.contextMenu.title")}
      description={i18n.t("options.contextMenu.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <ContextMenuPreview />
      <EnableItem />
    </PageLayout>
  )
}
