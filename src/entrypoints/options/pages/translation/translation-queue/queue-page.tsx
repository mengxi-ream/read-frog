import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { PageLayout } from "../../../components/page-layout"
import { BatchTranslationItems } from "./batch-items"
import { PreloadItems } from "./preload-items"
import { RequestRateItems } from "./request-rate-items"

/**
 * Drilled into from the Translation page: how fast requests go out, how much text each carries,
 * and how far ahead of the reader they run. Every one of them trades speed against API cost.
 */
export function TranslationQueuePage() {
  return (
    <PageLayout
      title={i18n.t("options.translation.title")}
      description={i18n.t("options.translation.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/page-translation"
        title={
          <span id="translation-queue">{i18n.t("options.translation.translationQueue.title")}</span>
        }
      >
        <RequestRateItems />
        <BatchTranslationItems />
        <PreloadItems />
      </ConfigDetailSection>
    </PageLayout>
  )
}
