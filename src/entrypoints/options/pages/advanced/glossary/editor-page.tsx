import { Navigate, useParams } from "react-router"
import { env } from "@/env"
import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { ConfigSection } from "../../../components/config-section"
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
 * One glossary, opened from the library.
 *
 * Three sections, because the page answers three different questions: what this
 * glossary IS and where it applies, what is IN it, and what to do with the list
 * as a whole. The destructive blocks are last, immediately after the export that
 * is the way out of them.
 */
export function GlossaryEditorPage() {
  const { glossaryId = "" } = useParams<{ glossaryId: string }>()
  const { data: glossary, isPending } = useGlossary(glossaryId)

  // Deleted in another tab, or an address someone typed. Nothing to edit, so go
  // back to the library rather than render an empty shell.
  if (!isPending && !glossary) {
    return <Navigate to="/advanced/glossary" replace />
  }
  // The first read is still in flight. Rendering the frame now would show a
  // section titled with nothing, which reads as a glossary that lost its name.
  if (!glossary) {
    return null
  }

  return (
    <PageLayout
      title={i18n.t("options.advanced.glossary.title")}
      description={i18n.t("options.advanced.glossary.pageDescription")}
      innerClassName="flex flex-col gap-10"
    >
      <ConfigDetailSection
        backTo="/advanced/glossary"
        title={
          <span id="glossary-editor" className="truncate">
            {glossary.name}
          </span>
        }
        // On the page where the questions come up — what a website pattern covers,
        // what an empty translation does, which providers honour any of it — rather
        // than beside one of the controls, because it answers all of them.
        action={
          <a
            href={`${env.WXT_WEBSITE_URL}/docs/glossary`}
            className="shrink-0 text-xs font-normal text-link hover:opacity-90"
            target="_blank"
            rel="noreferrer"
          >
            {i18n.t("options.advanced.glossary.editor.docsLink")}
          </a>
        }
      >
        <GlossaryEditorEnableItem glossary={glossary} />
        {/* Keyed on the glossary so the debounced name and description fields
            reset when a different one is opened without this unmounting. */}
        <GlossaryDetailsItem key={glossary.id} glossary={glossary} />
        <GlossarySitesItem glossary={glossary} />
      </ConfigDetailSection>

      <ConfigSection
        id="glossary-terms"
        title={i18n.t("options.advanced.glossary.editor.sections.terms")}
      >
        <GlossaryAddTermItem glossaryId={glossary.id} />
        {/* Keyed for the same reason the details form is: opening a different
            glossary does not unmount this page, and every piece of state the
            table holds — the search, the page number, which row is open for
            editing, the frozen row order — is about the list that was on screen
            a moment ago. */}
        <GlossaryTable key={glossary.id} glossaryId={glossary.id} />
      </ConfigSection>

      <ConfigSection
        id="glossary-maintenance"
        title={i18n.t("options.advanced.glossary.editor.sections.maintenance")}
      >
        <GlossaryImportExport glossaryId={glossary.id} glossaryName={glossary.name} />
        <GlossaryDeleteAllItem glossaryId={glossary.id} />
        <GlossaryDeleteItem glossary={glossary} />
      </ConfigSection>
    </PageLayout>
  )
}
