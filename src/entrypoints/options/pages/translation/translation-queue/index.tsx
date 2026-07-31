import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"
import { BatchTranslationItems } from "./batch-items"
import { PreloadItems } from "./preload-items"
import { RequestRateItems } from "./request-rate-items"

/**
 * The dials on the requests themselves — how fast they go out, how much text each carries, and
 * how far ahead of the reader they run. Every one of them trades speed against API cost.
 */
export function TranslationQueueSection() {
  return (
    <ConfigSection
      id="translation-queue"
      title={i18n.t("options.translation.translationQueue.title")}
    >
      <RequestRateItems />
      <BatchTranslationItems />
      <PreloadItems />
    </ConfigSection>
  )
}
