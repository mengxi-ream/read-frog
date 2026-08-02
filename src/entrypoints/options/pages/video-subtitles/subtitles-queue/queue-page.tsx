import { i18n } from "@/utils/i18n"
import { ConfigDetailSection } from "../../../components/config-detail-section"
import { PageLayout } from "../../../components/page-layout"
import { BatchTranslationItems } from "./batch-items"
import { RequestRateItems } from "./request-rate-items"

/**
 * Drilled into from the Video Subtitles page: how fast subtitle requests go out and how many
 * lines each carries. Both trade the speed subtitles catch up at against API cost.
 */
export function SubtitlesQueuePage() {
  return (
    <PageLayout
      title={i18n.t("options.videoSubtitles.title")}
      description={i18n.t("options.videoSubtitles.pageDescription")}
    >
      <ConfigDetailSection
        backTo="/video-subtitles"
        title={
          <span id="subtitles-queue">{i18n.t("options.videoSubtitles.subtitlesQueue.title")}</span>
        }
      >
        <RequestRateItems />
        <BatchTranslationItems />
      </ConfigDetailSection>
    </PageLayout>
  )
}
