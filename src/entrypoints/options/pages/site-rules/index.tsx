import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { BuiltInRules } from "./built-in-rules"
import { UserRulesEditor } from "./user-rules-editor"

export function SiteRulesPage() {
  return (
    <PageLayout title={i18n.t("options.siteRules.title")} innerClassName="*:border-b [&>*:last-child]:border-b-0">
      <UserRulesEditor />
      <BuiltInRules />
    </PageLayout>
  )
}
