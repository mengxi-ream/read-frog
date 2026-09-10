import { Navigate, useParams } from "react-router"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { PageLayout } from "../../../components/page-layout"
import { GlossaryAddTermItem } from "./add-term-item"
import { GlossaryDeleteAllItem } from "./delete-all-item"
import { GlossaryDeleteItem } from "./editor/delete-item"
import { GlossaryDetailsItem } from "./editor/details-item"
import { GlossaryEditorEnableItem } from "./editor/enable-item"
import { GlossarySitesItem } from "./editor/sites-item"
import { GlossaryTable } from "./glossary-table"
import { GlossaryImportExport } from "./import-export"
import { useGlossary } from "./use-glossary"

/**
 * One glossary, opened from the library: what it is called, where it applies,
 * and the terms themselves. Each block is a `ConfigItem` so the page reads like
 * every other settings page rather than a loose stack of controls; the
 * destructive ones are last, immediately after the export that is the way out.
 */
export function GlossaryEditorPage() {
  const { glossaryId = "" } = useParams<{ glossaryId: string }>()
  const { data: glossary, isPending } = useGlossary(glossaryId)

  // Deleted in another tab, or an address someone typed. Nothing to edit, so go
  // back to the library rather than render an empty shell.
  if (!isPending && !glossary) {
    return <Navigate to="/advanced/glossary" replace />
  }

  return (
    <PageLayout
      title={i18n.t("options.advanced.glossary.title")}
      description={i18n.t("options.advanced.glossary.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/advanced/glossary"
        title={<span id="glossary-editor">{glossary?.name}</span>}
      >
        {glossary && (
          <>
            <GlossaryEditorEnableItem glossary={glossary} />
            {/* Keyed on the glossary so the debounced name and description
                fields reset when a different one is opened. */}
            <GlossaryDetailsItem key={glossary.id} glossary={glossary} />
            <GlossarySitesItem glossary={glossary} />
            <GlossaryAddTermItem glossaryId={glossary.id} />
            <GlossaryTable glossaryId={glossary.id} />
            <GlossaryImportExport glossaryId={glossary.id} glossaryName={glossary.name} />
            <GlossaryDeleteAllItem glossaryId={glossary.id} />
            <GlossaryDeleteItem glossary={glossary} />
          </>
        )}
      </ConfigDetailSection>
    </PageLayout>
  )
}
