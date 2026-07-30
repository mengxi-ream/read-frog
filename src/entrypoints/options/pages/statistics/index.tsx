import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { BatchRequestRecord } from "./charts"

export function StatisticsPage() {
  return (
    <PageLayout
      title={i18n.t("options.statistics.title")}
      description={i18n.t("options.statistics.pageDescription")}
      innerClassName="flex flex-col gap-8"
    >
      <BatchRequestRecord />
    </PageLayout>
  )
}
