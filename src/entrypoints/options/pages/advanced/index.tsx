import { i18n } from "@/utils/i18n"
import { PageLayout } from "../../components/page-layout"
import { GlossarySection } from "./glossary"

/**
 * Home for features that are powerful but not part of the everyday path. The
 * glossary is the first; later additions become siblings of it here rather than
 * new sidebar entries.
 */
export function AdvancedPage() {
  return (
    <PageLayout
      title={i18n.t("options.advanced.title")}
      description={i18n.t("options.advanced.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <GlossarySection />
    </PageLayout>
  )
}
