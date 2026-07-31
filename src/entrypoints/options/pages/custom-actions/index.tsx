import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { CustomActionsConfig } from "./custom-actions-config"

export function CustomActionsPage() {
  return (
    <PageLayout
      title={i18n.t("options.selectionToolbar.customActions.title")}
      description={i18n.t("options.selectionToolbar.customActions.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <CustomActionsConfig />
    </PageLayout>
  )
}
