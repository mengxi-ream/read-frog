import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../../components/page-layout"
import { GlossaryAppliesToItem } from "./applies-to-item"
import { GlossaryLibraryItem } from "./glossary-library-item"

/**
 * The glossary's own page, reached from the Advanced group in the sidebar.
 *
 * Holds where glossaries apply and the library; everything about one glossary —
 * its name, the sites it applies to, its terms — lives on the page you reach by
 * opening it, so this stays readable however many glossaries there are.
 */
export function GlossaryPage() {
  return (
    <PageLayout
      title={i18n.t("options.advanced.glossary.title")}
      description={i18n.t("options.advanced.glossary.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <GlossaryAppliesToItem />
      <GlossaryLibraryItem />
    </PageLayout>
  )
}
