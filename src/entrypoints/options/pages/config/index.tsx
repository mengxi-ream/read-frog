import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { AboutCard } from "./about-card"
import { BetaExperienceConfig } from "./beta-experience"
import { ConfigBackup } from "./config-backup"
import { ResetConfig } from "./reset-config"

export function ConfigPage() {
  return (
    <PageLayout
      title={i18n.t("options.config.title")}
      description={i18n.t("options.config.pageDescription")}
      innerClassName="*:border-b [&>*:last-child]:border-b-0"
    >
      <BetaExperienceConfig />
      <ConfigBackup />
      <AboutCard />
      <ResetConfig />
    </PageLayout>
  )
}
