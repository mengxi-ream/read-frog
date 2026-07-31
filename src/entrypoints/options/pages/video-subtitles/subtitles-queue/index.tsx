import { i18n } from "@/utils/i18n"
import { ConfigSection } from "../../../components/config-section"
import { BatchTranslationItems } from "./batch-items"
import { RequestRateItems } from "./request-rate-items"

/**
 * The dials on the subtitle requests themselves — how fast they go out and how many lines each
 * carries. Both trade the speed subtitles catch up at against API cost.
 */
export function SubtitlesQueueSection() {
  return (
    <ConfigSection
      id="subtitles-queue"
      title={i18n.t("options.videoSubtitles.subtitlesQueue.title")}
    >
      <RequestRateItems />
      <BatchTranslationItems />
    </ConfigSection>
  )
}
