import { i18n } from "#imports"
import { PageLayout } from "../../components/page-layout"
import { SelectionTranslationAutoPronunciation } from "./selection-translation-auto-pronunciation"
import { SelectionTranslationDisabledSites } from "./selection-translation-disabled-sites"
import { SelectionTranslationProvider } from "./selection-translation-provider"
import { SelectionTranslationToggle } from "./selection-translation-toggle"
import { SelectionTranslationTriggerMode } from "./selection-translation-trigger-mode"

export function SelectionTranslationPage() {
  return (
    <PageLayout title={i18n.t("options.overlayTools.selectionTranslation.title")}>
      <div className="*:border-b [&>*:last-child]:border-b-0">
        <SelectionTranslationToggle />
        <SelectionTranslationProvider />
        <SelectionTranslationAutoPronunciation />
        <SelectionTranslationTriggerMode />
        <SelectionTranslationDisabledSites />
      </div>
    </PageLayout>
  )
}
