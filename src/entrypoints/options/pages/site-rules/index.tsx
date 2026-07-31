import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../components/config-detail-section"
import { PageLayout } from "../../components/page-layout"
import { BuiltInRules } from "./built-in-rules"
import { UserRulesEditor } from "./user-rules-editor"

/**
 * Drilled into from Page Translation's Translation control section: rules are per-site
 * adjustments to how that page gets translated, and a JSON editor beside a list of every
 * built-in rule is far more than the row that opens it could hold.
 */
export function SiteRulesPage() {
  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/page-translation"
        title={<span id="site-rules">{i18n.t("options.siteRules.title")}</span>}
      >
        <UserRulesEditor />
        <BuiltInRules />
      </ConfigDetailSection>
    </PageLayout>
  )
}
