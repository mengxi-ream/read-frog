import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { PageLayout } from "../../../components/page-layout"
import { GlossaryAddTermItem } from "./add-term-item"
import { GlossaryDeleteAllItem } from "./delete-all-item"
import { GlossaryTable } from "./glossary-table"
import { GlossaryImportExport } from "./import-export"

/**
 * Drilled into from Advanced: add one term, browse the list, move the whole
 * list in or out, empty it — each a `ConfigItem` so they read like every other
 * settings page rather than a loose stack of controls. The destructive block is
 * last, immediately after the export that is the way out of it.
 */
export function GlossaryTermsPage() {
  return (
    <PageLayout
      title={i18n.t("options.advanced.title")}
      description={i18n.t("options.advanced.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/advanced"
        title={<span id="glossary-terms">{i18n.t("options.advanced.glossary.terms.title")}</span>}
      >
        <GlossaryAddTermItem />
        <GlossaryTable />
        <GlossaryImportExport />
        <GlossaryDeleteAllItem />
      </ConfigDetailSection>
    </PageLayout>
  )
}
