import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { CustomActionsConfig } from "./custom-actions-config"

export function CustomActionsPage() {
  return (
    <PageLayout title={i18n.t("options.floatingButtonAndToolbar.selectionToolbar.customActions.title")}>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <CustomActionsConfig />
      </div>
    </PageLayout>
  )
}
