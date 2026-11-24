import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { UsageCard } from "./usage-card"

export function UsagePage() {
  return (
    <PageLayout
      title={i18n.t("options.usage.title")}
      description={i18n.t("options.usage.pageDescription")}
    >
      <UsageCard />
    </PageLayout>
  )
}
